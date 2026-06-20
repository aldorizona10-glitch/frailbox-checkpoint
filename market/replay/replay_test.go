package replay

import (
	"strings"
	"testing"
)

func TestValidateExpectedReportsEventIndexAndActualSnapshot(t *testing.T) {
	fixture := &Fixture{
		Name:   "mismatched-snapshot",
		Symbol: "ETH-USD",
		Events: []Event{
			{
				Type: "order",
				Order: &OrderEvent{
					ID:       "bid-1",
					Side:     "buy",
					Type:     "limit",
					Price:    "101",
					Quantity: "2",
				},
			},
		},
		Expected: ExpectedOutcome{
			Snapshot: Snapshot{
				Bids: []Level{
					{Price: "102", Quantity: "2", Count: 1},
				},
			},
		},
	}

	result, err := ReplayFixture(fixture)
	if err != nil {
		t.Fatalf("replay fixture: %v", err)
	}
	err = ValidateExpected(result)
	if err == nil {
		t.Fatal("expected snapshot validation to fail")
	}
	message := err.Error()
	for _, want := range []string{"event 0", "expected", "actual"} {
		if !strings.Contains(message, want) {
			t.Fatalf("expected error to include %q, got %q", want, message)
		}
	}
}
