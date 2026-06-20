package orderbook_test

import (
	"path/filepath"
	"testing"

	"github.com/tent-of-trials/market/replay"
)

func TestReplayFixturesOrderBookSnapshots(t *testing.T) {
	fixtures := []string{
		"single-level-add.json",
		"two-sided-cancel.json",
	}

	for _, name := range fixtures {
		t.Run(name, func(t *testing.T) {
			result, err := replay.ReplayFile(filepath.Join("..", "testdata", "replay", name))
			if err != nil {
				t.Fatalf("replay fixture: %v", err)
			}
			if err := replay.ValidateExpected(result); err != nil {
				t.Fatalf("validate fixture: %v", err)
			}
		})
	}
}
