package orderbook

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/types"
)

func newTestOrder(side types.OrderSide, price, qty string) *types.Order {
	return &types.Order{
		Side:         side,
		Type:         types.Limit,
		Price:        decimal.RequireFromString(price),
		Quantity:     decimal.RequireFromString(qty),
		RemainingQty: decimal.RequireFromString(qty),
	}
}

func TestAddBuyOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})
	order := newTestOrder(types.Buy, "50000.00", "1.5")

	trades, err := ob.AddOrder(order)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(trades) != 0 {
		t.Fatalf("expected 0 trades, got %d", len(trades))
	}

	bids := ob.GetBids()
	if len(bids) != 1 {
		t.Fatalf("expected 1 bid level, got %d", len(bids))
	}
	if !bids[0].Price.Equal(order.Price) {
		t.Errorf("expected bid price %s, got %s", order.Price, bids[0].Price)
	}
	if order.ID == "" {
		t.Error("expected order ID to be set")
	}
	if order.Status != types.New {
		t.Errorf("expected status New, got %v", order.Status)
	}
}

func TestAddSellOrder(t *testing.T) {
	ob := NewOrderBook("ETHUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})
	order := newTestOrder(types.Sell, "3000.00", "2.0")

	_, err := ob.AddOrder(order)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	asks := ob.GetAsks()
	if len(asks) != 1 {
		t.Fatalf("expected 1 ask level, got %d", len(asks))
	}
	if !asks[0].Price.Equal(order.Price) {
		t.Errorf("expected ask price %s, got %s", order.Price, asks[0].Price)
	}
}

func TestCancelOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})
	order := newTestOrder(types.Buy, "50000.00", "1.0")

	_, err := ob.AddOrder(order)
	if err != nil {
		t.Fatalf("AddOrder failed: %v", err)
	}

	err = ob.CancelOrder(order.ID)
	if err != nil {
		t.Fatalf("expected no error on cancel, got %v", err)
	}

	bids := ob.GetBids()
	if len(bids) != 0 {
		t.Errorf("expected 0 bids after cancel, got %d", len(bids))
	}
}

func TestCancelNonexistentOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})

	err := ob.CancelOrder("does-not-exist")
	if err == nil {
		t.Fatal("expected error for non-existent order, got nil")
	}
	if err != ErrOrderNotFound {
		t.Errorf("expected ErrOrderNotFound, got %v", err)
	}
}

func TestAddOrderToClosedBook(t *testing.T) {
	ob := NewOrderBook("BTCUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})
	ob.Close()

	order := newTestOrder(types.Buy, "50000.00", "1.0")
	_, err := ob.AddOrder(order)
	if err == nil {
		t.Fatal("expected error on closed book, got nil")
	}
	if err != ErrBookClosed {
		t.Errorf("expected ErrBookClosed, got %v", err)
	}
}

func TestOrderMapConsistency(t *testing.T) {
	ob := NewOrderBook("BTCUSDT", Config{MaxDepth: 100, PriceDecimals: 2, VolumeDecimals: 8})

	o1 := newTestOrder(types.Buy, "50000.00", "1.0")
	o2 := newTestOrder(types.Sell, "51000.00", "2.0")

	ob.AddOrder(o1)
	ob.AddOrder(o2)

	// both should be in the book
	bids := ob.GetBids()
	asks := ob.GetAsks()
	if len(bids) != 1 || len(asks) != 1 {
		t.Fatalf("expected 1 bid and 1 ask, got %d bids, %d asks", len(bids), len(asks))
	}

	// cancel o1, o2 should still exist
	ob.CancelOrder(o1.ID)
	bids = ob.GetBids()
	asks = ob.GetAsks()
	if len(bids) != 0 {
		t.Errorf("expected 0 bids after cancel, got %d", len(bids))
	}
	if len(asks) != 1 {
		t.Errorf("expected 1 ask still present, got %d", len(asks))
	}

	// cancelling o1 again should fail
	err := ob.CancelOrder(o1.ID)
	if err != ErrOrderNotFound {
		t.Errorf("expected ErrOrderNotFound on double cancel, got %v", err)
	}
}
