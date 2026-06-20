package matching_test

import (
	"path/filepath"
	"testing"

	"github.com/tent-of-trials/market/replay"
)

func TestReplayFixtureTradeAndAnalytics(t *testing.T) {
	result, err := replay.ReplayFile(filepath.Join("..", "testdata", "replay", "trade-analytics.json"))
	if err != nil {
		t.Fatalf("replay fixture: %v", err)
	}
	if err := replay.ValidateExpected(result); err != nil {
		t.Fatalf("validate fixture: %v", err)
	}
	if len(result.Trades) != 1 {
		t.Fatalf("expected one fixture trade, got %d", len(result.Trades))
	}
	if result.Analytics.BufferedSamples != 3 {
		t.Fatalf("expected three replay analytics samples, got %d", result.Analytics.BufferedSamples)
	}
}
