package orderbook

import (
	"fmt"
	"sync"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/types"
)

func TestLevelAccessorsReturnImmutableCopies(t *testing.T) {
	book := newTestBook()
	mustAddOrder(t, book, "bid-1", types.Buy, "100", "5")
	mustAddOrder(t, book, "ask-1", types.Sell, "110", "3")

	bids := book.GetBids()
	asks := book.GetAsks()
	if len(bids) != 1 || len(asks) != 1 {
		t.Fatalf("expected one bid and one ask, got bids=%d asks=%d", len(bids), len(asks))
	}

	bids[0].Price = decimal.RequireFromString("1")
	bids[0].Quantity = decimal.Zero
	asks[0].Price = decimal.RequireFromString("999")
	asks[0].Quantity = decimal.Zero

	snapshot := book.GetSnapshot()
	if got := snapshot.Bids[0].Price.String(); got != "100" {
		t.Fatalf("bid price leaked through accessor mutation: got %s, want 100", got)
	}
	if got := snapshot.Bids[0].Quantity.String(); got != "5" {
		t.Fatalf("bid quantity leaked through accessor mutation: got %s, want 5", got)
	}
	if got := snapshot.Asks[0].Price.String(); got != "110" {
		t.Fatalf("ask price leaked through accessor mutation: got %s, want 110", got)
	}
	if got := snapshot.Asks[0].Quantity.String(); got != "3" {
		t.Fatalf("ask quantity leaked through accessor mutation: got %s, want 3", got)
	}
}

func TestConcurrentSnapshotsAndUpdatesAreRaceSafe(t *testing.T) {
	book := newTestBook()
	start := make(chan struct{})
	errCh := make(chan error, 16)

	var wg sync.WaitGroup
	for writer := 0; writer < 4; writer++ {
		wg.Add(1)
		go func(writer int) {
			defer wg.Done()
			<-start
			for i := 0; i < 200; i++ {
				side := types.Buy
				price := 10000 + writer*1000 + i
				if i%2 == 1 {
					side = types.Sell
					price = 20000 + writer*1000 + i
				}
				id := fmt.Sprintf("writer-%d-%d", writer, i)
				_, err := book.AddOrder(testOrder(id, side, decimal.NewFromInt(int64(price)), decimal.NewFromInt(1)))
				if err != nil {
					errCh <- fmt.Errorf("add %s: %w", id, err)
					return
				}
				if i%5 == 0 {
					if err := book.CancelOrder(id); err != nil {
						errCh <- fmt.Errorf("cancel %s: %w", id, err)
						return
					}
				}
			}
		}(writer)
	}

	for reader := 0; reader < 4; reader++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			for i := 0; i < 400; i++ {
				snapshot := book.GetSnapshot()
				if err := assertSnapshotSorted(snapshot); err != nil {
					errCh <- err
					return
				}
				for _, level := range book.GetBids() {
					if level == nil {
						errCh <- fmt.Errorf("nil bid level")
						return
					}
				}
				for _, level := range book.GetAsks() {
					if level == nil {
						errCh <- fmt.Errorf("nil ask level")
						return
					}
				}
			}
		}()
	}

	close(start)
	wg.Wait()
	close(errCh)

	for err := range errCh {
		if err != nil {
			t.Fatal(err)
		}
	}
}

func assertSnapshotSorted(snapshot *types.DepthUpdate) error {
	for i := 1; i < len(snapshot.Bids); i++ {
		if snapshot.Bids[i].Price.GreaterThan(snapshot.Bids[i-1].Price) {
			return fmt.Errorf("bids not sorted descending at index %d: %s > %s",
				i, snapshot.Bids[i].Price, snapshot.Bids[i-1].Price)
		}
	}
	for i := 1; i < len(snapshot.Asks); i++ {
		if snapshot.Asks[i].Price.LessThan(snapshot.Asks[i-1].Price) {
			return fmt.Errorf("asks not sorted ascending at index %d: %s < %s",
				i, snapshot.Asks[i].Price, snapshot.Asks[i-1].Price)
		}
	}
	return nil
}

func newTestBook() *OrderBook {
	return NewOrderBook("ETH-USD", Config{
		MaxDepth:       1000,
		PriceDecimals:  8,
		VolumeDecimals: 8,
	})
}

func mustAddOrder(t *testing.T, book *OrderBook, id string, side types.OrderSide, price string, quantity string) {
	t.Helper()
	_, err := book.AddOrder(testOrder(
		id,
		side,
		decimal.RequireFromString(price),
		decimal.RequireFromString(quantity),
	))
	if err != nil {
		t.Fatalf("add order %s: %v", id, err)
	}
}

func testOrder(id string, side types.OrderSide, price decimal.Decimal, quantity decimal.Decimal) *types.Order {
	return &types.Order{
		ID:           id,
		Symbol:       "ETH-USD",
		Side:         side,
		Type:         types.Limit,
		Price:        price,
		Quantity:     quantity,
		RemainingQty: quantity,
		LeavesQty:    quantity,
		TimeInForce:  types.GTC,
	}
}
