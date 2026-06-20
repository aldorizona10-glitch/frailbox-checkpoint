package gateway

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func buildMiddlewareOrderTestChain(t *testing.T, handler http.Handler, rate float64, burst int) (http.Handler, *bytes.Buffer) {
	t.Helper()

	logBuffer := &bytes.Buffer{}
	previousOutput := log.Writer()
	previousFlags := log.Flags()
	log.SetOutput(logBuffer)
	log.SetFlags(0)
	t.Cleanup(func() {
		log.SetOutput(previousOutput)
		log.SetFlags(previousFlags)
	})

	wrapped := RecoveryMiddleware(
		RequestIDMiddleware(
			LoggingMiddleware(
				CORSMiddleware([]string{"https://client.example"}, time.Minute)(
					AuthMiddleware(
						RateLimitMiddleware(rate, burst)(
							MetricsMiddleware(handler),
						),
					),
				),
			),
		),
	)

	return wrapped, logBuffer
}

func newGatewayMiddlewareRequest(token string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	req.RemoteAddr = "203.0.113.10:48152"
	req.Header.Set("Origin", "https://client.example")
	req.Header.Set("X-Request-ID", "request-under-test")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return req
}

func decodeResponseBody(t *testing.T, body io.Reader) map[string]interface{} {
	t.Helper()

	var payload map[string]interface{}
	if err := json.NewDecoder(body).Decode(&payload); err != nil {
		t.Fatalf("decode response body: %v", err)
	}
	return payload
}

func TestMiddlewareChainAuthBeforeRateLimit(t *testing.T) {
	handlerHits := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerHits++

		if got := r.Context().Value(ContextKeyUserID); got != "user_stub" {
			t.Fatalf("handler saw user context %v, want user_stub", got)
		}
		if got := r.Context().Value(ContextKeySessionID); got != "session_stub" {
			t.Fatalf("handler saw session context %v, want session_stub", got)
		}
		if got := r.Context().Value(ContextKeyAuthMethod); got != "bearer" {
			t.Fatalf("handler saw auth method %v, want bearer", got)
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
	})

	chain, logs := buildMiddlewareOrderTestChain(t, handler, 0.001, 2)

	cases := []struct {
		name           string
		token          string
		wantStatus     int
		wantError      string
		wantHandlerHit bool
	}{
		{
			name:       "unauthenticated request returns 401 before rate limiting",
			wantStatus: http.StatusUnauthorized,
			wantError:  "unauthorized",
		},
		{
			name:       "second unauthenticated request still returns 401 before rate limiting",
			wantStatus: http.StatusUnauthorized,
			wantError:  "unauthorized",
		},
		{
			name:           "first authenticated request reaches handler with auth context",
			token:          "valid-token",
			wantStatus:     http.StatusOK,
			wantHandlerHit: true,
		},
		{
			name:           "second authenticated request consumes remaining authenticated budget",
			token:          "valid-token",
			wantStatus:     http.StatusOK,
			wantHandlerHit: true,
		},
		{
			name:       "third authenticated request returns structured 429",
			token:      "valid-token",
			wantStatus: http.StatusTooManyRequests,
			wantError:  "rate_limit_exceeded",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			beforeHits := handlerHits
			recorder := httptest.NewRecorder()
			chain.ServeHTTP(recorder, newGatewayMiddlewareRequest(tc.token))

			if recorder.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d, body=%s", recorder.Code, tc.wantStatus, recorder.Body.String())
			}

			if recorder.Header().Get("X-Request-ID") != "request-under-test" {
				t.Fatalf("missing preserved request id header")
			}
			if recorder.Header().Get("Access-Control-Allow-Origin") != "https://client.example" {
				t.Fatalf("missing CORS header on %d response", recorder.Code)
			}

			hitDelta := handlerHits - beforeHits
			if tc.wantHandlerHit && hitDelta != 1 {
				t.Fatalf("handler hit delta = %d, want 1", hitDelta)
			}
			if !tc.wantHandlerHit && hitDelta != 0 {
				t.Fatalf("handler hit delta = %d, want 0", hitDelta)
			}

			payload := decodeResponseBody(t, recorder.Body)
			if tc.wantError != "" && payload["error"] != tc.wantError {
				t.Fatalf("error payload = %v, want %q", payload, tc.wantError)
			}
			if tc.wantStatus == http.StatusTooManyRequests && payload["message"] == "" {
				t.Fatalf("429 payload missing message: %v", payload)
			}
		})
	}

	if handlerHits != 2 {
		t.Fatalf("handler hits = %d, want 2", handlerHits)
	}

	logText := logs.String()
	for _, status := range []string{"401", "200", "429"} {
		if !strings.Contains(logText, "GET /api/v1/orders "+status) {
			t.Fatalf("log output %q does not include status %s", logText, status)
		}
	}
}

func TestMiddlewareChainPreflightBypassesAuthAndRateLimit(t *testing.T) {
	handlerHits := 0
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerHits++
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
	})

	chain, _ := buildMiddlewareOrderTestChain(t, handler, 0.001, 1)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/orders", nil)
	req.RemoteAddr = "203.0.113.10:48152"
	req.Header.Set("Origin", "https://client.example")
	recorder := httptest.NewRecorder()

	chain.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if handlerHits != 0 {
		t.Fatalf("preflight handler hits = %d, want 0", handlerHits)
	}
	if recorder.Header().Get("Access-Control-Allow-Origin") != "https://client.example" {
		t.Fatalf("missing preflight CORS header")
	}
}
