package matching

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
)

func TestMatchingEngine_PlaceOrder(t *testing.T) {
	book := orderbook.NewOrderBook("BTCUSD", orderbook.Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	books := map[types.Symbol]*orderbook.OrderBook{"BTCUSD": book}
	engine := NewMatchingEngine(EngineConfig{}, books)

	order := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	trades, err := engine.PlaceOrder(order)
	if err != nil {
		t.Fatalf("PlaceOrder succeeded, got error: %v", err)
	}
	if trades == nil {
		t.Error("Expected trades (possibly empty), got nil")
	}
	if order.Status != types.Filled {
		t.Errorf("Expected order status Filled, got %v", order.Status)
	}
	if engine.GetTradeCount() < 0 {
		t.Error("Trade count should be >= 0")
	}
}

func TestMatchingEngine_PlaceOrder_UnknownSymbol(t *testing.T) {
	book := orderbook.NewOrderBook("BTCUSD", orderbook.Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	books := map[types.Symbol]*orderbook.OrderBook{"BTCUSD": book}
	engine := NewMatchingEngine(EngineConfig{}, books)

	order := &types.Order{
		Symbol: "ETHUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(2000),
		Quantity: decimal.NewFromInt(1),
	}
	_, err := engine.PlaceOrder(order)
	if err == nil {
		t.Error("Expected ErrSymbolNotFound for unknown symbol")
	} else if err.Error() != "symbol not found" {
		t.Errorf("Expected 'symbol not found', got %v", err)
	}
}

func TestMatchingEngine_CancelOrder(t *testing.T) {
	book := orderbook.NewOrderBook("BTCUSD", orderbook.Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	books := map[types.Symbol]*orderbook.OrderBook{"BTCUSD": book}
	engine := NewMatchingEngine(EngineConfig{}, books)

	order := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Sell,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	engine.PlaceOrder(order)
	orderID := order.ID
	err := engine.CancelOrder("BTCUSD", orderID)
	if err != nil {
		t.Fatalf("CancelOrder failed: %v", err)
	}
	if order.Status != types.Cancelled {
		t.Errorf("Expected order status Cancelled, got %v", order.Status)
	}
}

func TestMatchingEngine_CancelOrder_UnknownSymbol(t *testing.T) {
	book := orderbook.NewOrderBook("BTCUSD", orderbook.Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	books := map[types.Symbol]*orderbook.OrderBook{"BTCUSD": book}
	engine := NewMatchingEngine(EngineConfig{}, books)

	err := engine.CancelOrder("ETHUSD", "nonexistent")
	if err == nil {
		t.Error("Expected ErrSymbolNotFound for unknown symbol")
	} else if err.Error() != "symbol not found" {
		t.Errorf("Expected 'symbol not found', got %v", err)
	}
}

func TestMatchingEngine_TradeCount(t *testing.T) {
	book := orderbook.NewOrderBook("BTCUSD", orderbook.Config{MaxDepth: 10, PriceDecimals: 2, VolumeDecimals: 2})
	books := map[types.Symbol]*orderbook.OrderBook{"BTCUSD": book}
	engine := NewMatchingEngine(EngineConfig{}, books)

	// Two matching orders at same price produce a trade
	buy := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Buy,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	engine.PlaceOrder(buy)

	sell := &types.Order{
		Symbol: "BTCUSD",
		Side:   types.Sell,
		Type:   types.Limit,
		Price:  decimal.NewFromInt(10000),
		Quantity: decimal.NewFromInt(1),
	}
	engine.PlaceOrder(sell)

	count := engine.GetTradeCount()
	if count < 1 {
		t.Errorf("Expected at least 1 trade, got %d", count)
	}
}
