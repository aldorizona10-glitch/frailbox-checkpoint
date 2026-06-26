package matching

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
)

const testSymbol types.Symbol = "BTC-USD"

func testEngine() (*MatchingEngine, *orderbook.OrderBook) {
	book := orderbook.NewOrderBook(testSymbol, orderbook.Config{
		MaxDepth:       10,
		PriceDecimals:  2,
		VolumeDecimals: 8,
	})
	engine := NewMatchingEngine(EngineConfig{EnableShorting: true}, map[types.Symbol]*orderbook.OrderBook{
		testSymbol: book,
	})
	return engine, book
}

func testOrder(symbol types.Symbol, side types.OrderSide) *types.Order {
	qty := decimal.RequireFromString("1.5")
	return &types.Order{
		Symbol:       symbol,
		Side:         side,
		Type:         types.Limit,
		Price:        decimal.RequireFromString("25000.00"),
		Quantity:     qty,
		RemainingQty: qty,
	}
}

func TestPlaceOrderExistingSymbolAssignsMetadataAndFillsOrder(t *testing.T) {
	engine, book := testEngine()
	order := testOrder(testSymbol, types.Buy)

	trades, err := engine.PlaceOrder(order)
	if err != nil {
		t.Fatalf("PlaceOrder returned unexpected error: %v", err)
	}

	if len(trades) != 0 {
		t.Fatalf("expected no trades from current order book implementation, got %d", len(trades))
	}
	if order.ID == "" {
		t.Fatal("expected PlaceOrder to assign an order ID")
	}
	if order.Status != types.Filled {
		t.Fatalf("expected order status %v, got %v", types.Filled, order.Status)
	}
	if !order.FilledQty.Equal(order.Quantity) {
		t.Fatalf("expected filled quantity %s, got %s", order.Quantity, order.FilledQty)
	}
	if !order.RemainingQty.Equal(decimal.Zero) {
		t.Fatalf("expected zero remaining quantity, got %s", order.RemainingQty)
	}
	if order.CreatedAt.IsZero() || order.UpdatedAt.IsZero() {
		t.Fatal("expected PlaceOrder to set CreatedAt and UpdatedAt")
	}
	if bids := book.GetBids(); len(bids) != 1 {
		t.Fatalf("expected order to be added to bids, got %d bid levels", len(bids))
	}
}

func TestPlaceOrderUnknownSymbolReturnsErrSymbolNotFound(t *testing.T) {
	engine, _ := testEngine()
	order := testOrder(types.Symbol("DOGE-USD"), types.Buy)

	trades, err := engine.PlaceOrder(order)
	if err != ErrSymbolNotFound {
		t.Fatalf("expected ErrSymbolNotFound, got trades=%v err=%v", trades, err)
	}
}

func TestCancelOrderSuccessRemovesOrderFromBook(t *testing.T) {
	engine, book := testEngine()
	order := testOrder(testSymbol, types.Buy)

	if _, err := engine.PlaceOrder(order); err != nil {
		t.Fatalf("PlaceOrder returned unexpected error: %v", err)
	}
	if err := engine.CancelOrder(testSymbol, order.ID); err != nil {
		t.Fatalf("CancelOrder returned unexpected error: %v", err)
	}

	if order.Status != types.Cancelled {
		t.Fatalf("expected order status %v after cancellation, got %v", types.Cancelled, order.Status)
	}
	if bids := book.GetBids(); len(bids) != 0 {
		t.Fatalf("expected cancellation to remove bid level, got %d bid levels", len(bids))
	}
}

func TestCancelOrderUnknownSymbolReturnsErrSymbolNotFound(t *testing.T) {
	engine, _ := testEngine()

	err := engine.CancelOrder(types.Symbol("DOGE-USD"), "missing-order")
	if err != ErrSymbolNotFound {
		t.Fatalf("expected ErrSymbolNotFound, got %v", err)
	}
}

func TestTradeCountStaysAccurateWhenBookReturnsNoTrades(t *testing.T) {
	engine, _ := testEngine()

	for i := 0; i < 2; i++ {
		if _, err := engine.PlaceOrder(testOrder(testSymbol, types.Buy)); err != nil {
			t.Fatalf("PlaceOrder %d returned unexpected error: %v", i+1, err)
		}
	}

	if got := engine.GetTradeCount(); got != 0 {
		t.Fatalf("expected zero recorded trades, got %d", got)
	}
	if recent := engine.GetRecentTrades(10); len(recent) != 0 {
		t.Fatalf("expected no recent trades, got %d", len(recent))
	}
}
