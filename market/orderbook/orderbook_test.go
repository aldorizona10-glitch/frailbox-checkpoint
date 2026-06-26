package orderbook

import (
	"errors"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/types"
)

func testOrderBook() *OrderBook {
	return NewOrderBook(types.Symbol("BTC-USD"), Config{
		MaxDepth:       10,
		PriceDecimals:  2,
		VolumeDecimals: 8,
	})
}

func testOrder(id string, side types.OrderSide, price string, qty string) *types.Order {
	quantity := decimal.RequireFromString(qty)
	return &types.Order{
		ID:           id,
		Symbol:       types.Symbol("BTC-USD"),
		Side:         side,
		Type:         types.Limit,
		Price:        decimal.RequireFromString(price),
		Quantity:     quantity,
		RemainingQty: quantity,
		TimeInForce:  types.GTC,
	}
}

func TestAddBuyOrderStoresBidAndOrderState(t *testing.T) {
	book := testOrderBook()
	order := testOrder("buy-1", types.Buy, "100.25", "1.5")

	trades, err := book.AddOrder(order)
	if err != nil {
		t.Fatalf("AddOrder returned error: %v", err)
	}
	if trades != nil {
		t.Fatalf("expected no trades from add-only implementation, got %v", trades)
	}

	bids := book.GetBids()
	if len(bids) != 1 {
		t.Fatalf("expected 1 bid level, got %d", len(bids))
	}
	if !bids[0].Price.Equal(order.Price) || !bids[0].Quantity.Equal(order.RemainingQty) || bids[0].Count != 1 {
		t.Fatalf("bid level = %+v, want price %s qty %s count 1", bids[0], order.Price, order.RemainingQty)
	}
	if len(book.GetAsks()) != 0 {
		t.Fatalf("expected no ask levels after adding a buy order")
	}
	if got := book.orders[order.ID]; got != order {
		t.Fatalf("order map did not retain the added buy order")
	}
	if order.Status != types.New {
		t.Fatalf("order status = %v, want New", order.Status)
	}
}

func TestAddSellOrderStoresAskAndOrderState(t *testing.T) {
	book := testOrderBook()
	order := testOrder("sell-1", types.Sell, "101.75", "2.25")

	if _, err := book.AddOrder(order); err != nil {
		t.Fatalf("AddOrder returned error: %v", err)
	}

	tasks := book.GetAsks()
	if len(tasks) != 1 {
		t.Fatalf("expected 1 ask level, got %d", len(tasks))
	}
	if !tasks[0].Price.Equal(order.Price) || !tasks[0].Quantity.Equal(order.RemainingQty) || tasks[0].Count != 1 {
		t.Fatalf("ask level = %+v, want price %s qty %s count 1", tasks[0], order.Price, order.RemainingQty)
	}
	if len(book.GetBids()) != 0 {
		t.Fatalf("expected no bid levels after adding a sell order")
	}
	if got := book.orders[order.ID]; got != order {
		t.Fatalf("order map did not retain the added sell order")
	}
}

func TestAddOrdersSortsBookSides(t *testing.T) {
	book := testOrderBook()

	for _, order := range []*types.Order{
		testOrder("buy-low", types.Buy, "99", "1"),
		testOrder("buy-high", types.Buy, "101", "1"),
		testOrder("sell-high", types.Sell, "104", "1"),
		testOrder("sell-low", types.Sell, "102", "1"),
	} {
		if _, err := book.AddOrder(order); err != nil {
			t.Fatalf("AddOrder(%s) returned error: %v", order.ID, err)
		}
	}

	bids := book.GetBids()
	if got, want := bids[0].Price.String(), "101"; got != want {
		t.Fatalf("best bid price = %s, want %s", got, want)
	}
	asks := book.GetAsks()
	if got, want := asks[0].Price.String(), "102"; got != want {
		t.Fatalf("best ask price = %s, want %s", got, want)
	}
	if len(book.orders) != 4 {
		t.Fatalf("order map length = %d, want 4", len(book.orders))
	}
}

func TestCancelExistingOrderRemovesOrderAndLevel(t *testing.T) {
	book := testOrderBook()
	order := testOrder("buy-1", types.Buy, "100.25", "1.5")
	if _, err := book.AddOrder(order); err != nil {
		t.Fatalf("AddOrder returned error: %v", err)
	}

	if err := book.CancelOrder(order.ID); err != nil {
		t.Fatalf("CancelOrder returned error: %v", err)
	}

	if order.Status != types.Cancelled {
		t.Fatalf("order status = %v, want Cancelled", order.Status)
	}
	if _, exists := book.orders[order.ID]; exists {
		t.Fatalf("cancelled order still exists in order map")
	}
	if len(book.GetBids()) != 0 {
		t.Fatalf("expected bid level to be removed after cancellation")
	}
}

func TestCancelMissingOrderReturnsErrOrderNotFound(t *testing.T) {
	book := testOrderBook()

	err := book.CancelOrder("missing-order")
	if !errors.Is(err, ErrOrderNotFound) {
		t.Fatalf("CancelOrder error = %v, want ErrOrderNotFound", err)
	}
}

func TestClosedBookRejectsAddAndCancel(t *testing.T) {
	book := testOrderBook()
	book.Close()

	if _, err := book.AddOrder(testOrder("buy-1", types.Buy, "100", "1")); !errors.Is(err, ErrBookClosed) {
		t.Fatalf("AddOrder on closed book error = %v, want ErrBookClosed", err)
	}
	if err := book.CancelOrder("buy-1"); !errors.Is(err, ErrBookClosed) {
		t.Fatalf("CancelOrder on closed book error = %v, want ErrBookClosed", err)
	}
}
