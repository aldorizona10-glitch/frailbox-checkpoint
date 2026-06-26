package orderbook

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/types"
)

func TestOrderBook_AddOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSD", Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	order := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	trades, err := ob.AddOrder(order)
	if err != nil {
		t.Fatalf("AddOrder failed: %v", err)
	}
	if trades != nil {
		t.Errorf("Expected nil trades, got %v", trades)
	}
	if _, exists := ob.orders[order.ID]; !exists {
		t.Error("Order not added to order map")
	}
	bids := ob.GetBids()
	if len(bids) != 1 {
		t.Errorf("Expected 1 bid level, got %d", len(bids))
	}
}

func TestOrderBook_CancelOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSD", Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	order := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Sell,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	ob.AddOrder(order)
	err := ob.CancelOrder(order.ID)
	if err != nil {
		t.Fatalf("CancelOrder failed: %v", err)
	}
	if order.Status != types.Cancelled {
		t.Errorf("Expected order status Cancelled, got %v", order.Status)
	}
	if _, exists := ob.orders[order.ID]; exists {
		t.Error("Order should be removed from order map")
	}
}

func TestOrderBook_CancelNonExistentOrder(t *testing.T) {
	ob := NewOrderBook("BTCUSD", Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	err := ob.CancelOrder("nonexistent")
	if err == nil {
		t.Error("Expected ErrOrderNotFound")
	} else if err.Error() != "order not found" {
		t.Errorf("Expected 'order not found', got %v", err)
	}
}

func TestOrderBook_AddOrder_ClosedBook(t *testing.T) {
	ob := NewOrderBook("BTCUSD", Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	ob.Close()
	order := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	_, err := ob.AddOrder(order)
	if err == nil {
		t.Error("Expected ErrBookClosed when adding to closed book")
	} else if err.Error() != "order book is closed" {
		t.Errorf("Expected 'order book is closed', got %v", err)
	}
}

func TestOrderBook_StateConsistencyAfterOperations(t *testing.T) {
	ob := NewOrderBook("BTCUSD", Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	// Add buy order
	buy := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	ob.AddOrder(buy)
	// Add sell order
	sell := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Sell,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10001),
		Quantity: decimal.NewFromInt(1),
	}
	ob.AddOrder(sell)

	// Cancel buy
	ob.CancelOrder(buy.ID)

	// Check state: bids should be empty, asks should have sell
	bids := ob.GetBids()
	asks := ob.GetAsks()
	if len(bids) != 0 {
		t.Errorf("Expected 0 bids after cancel, got %d", len(bids))
	}
	if len(asks) != 1 {
		t.Errorf("Expected 1 ask, got %d", len(asks))
	}
	if asks[0].Price.Cmp(decimal.NewFromInt(10001)) != 0 {
		t.Errorf("Ask price not preserved")
	}
}
