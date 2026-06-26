package orderbook

import (
	"errors"
	"testing"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/types"
)

func testBook() *OrderBook {
	return NewOrderBook(types.Symbol("SOL-USD"), Config{
		MaxDepth:       20,
		PriceDecimals:  2,
		VolumeDecimals: 4,
	})
}

func testOrder(id string, side types.OrderSide, price, qty string) *types.Order {
	return &types.Order{
		ID:           id,
		Symbol:       types.Symbol("SOL-USD"),
		Side:         side,
		Type:         types.Limit,
		Price:        decimal.RequireFromString(price),
		Quantity:     decimal.RequireFromString(qty),
		RemainingQty: decimal.RequireFromString(qty),
		TimeInForce:  types.GTC,
	}
}

func TestAddOrderStoresBuySideAndOrderMap(t *testing.T) {
	book := testBook()
	order := testOrder("buy-1", types.Buy, "101.25", "3.5")

	trades, err := book.AddOrder(order)
	if err != nil {
		t.Fatalf("AddOrder returned error: %v", err)
	}
	if trades != nil {
		t.Fatalf("AddOrder returned trades = %v, want nil", trades)
	}

	bids := book.GetBids()
	if len(bids) != 1 {
		t.Fatalf("len(GetBids()) = %d, want 1", len(bids))
	}
	if !bids[0].Price.Equal(order.Price) || !bids[0].Quantity.Equal(order.RemainingQty) {
		t.Fatalf("bid level = %+v, want price %s quantity %s", bids[0], order.Price, order.RemainingQty)
	}
	if _, ok := book.orders[order.ID]; !ok {
		t.Fatalf("order %q was not stored in order map", order.ID)
	}
	if order.Status != types.New {
		t.Fatalf("order.Status = %v, want New", order.Status)
	}
}

func TestAddOrderStoresSellSideAndSortsAsksAscending(t *testing.T) {
	book := testBook()
	highAsk := testOrder("sell-high", types.Sell, "102.00", "1")
	lowAsk := testOrder("sell-low", types.Sell, "99.50", "2")

	if _, err := book.AddOrder(highAsk); err != nil {
		t.Fatalf("AddOrder(highAsk) returned error: %v", err)
	}
	if _, err := book.AddOrder(lowAsk); err != nil {
		t.Fatalf("AddOrder(lowAsk) returned error: %v", err)
	}

	asks := book.GetAsks()
	if len(asks) != 2 {
		t.Fatalf("len(GetAsks()) = %d, want 2", len(asks))
	}
	if !asks[0].Price.Equal(lowAsk.Price) || !asks[1].Price.Equal(highAsk.Price) {
		t.Fatalf("asks are not sorted ascending by price: %+v", asks)
	}
	if len(book.orders) != 2 {
		t.Fatalf("len(book.orders) = %d, want 2", len(book.orders))
	}
}

func TestCancelOrderRemovesOrderAndLevel(t *testing.T) {
	book := testBook()
	order := testOrder("buy-cancel", types.Buy, "98.75", "4")

	if _, err := book.AddOrder(order); err != nil {
		t.Fatalf("AddOrder returned error: %v", err)
	}
	if err := book.CancelOrder(order.ID); err != nil {
		t.Fatalf("CancelOrder returned error: %v", err)
	}

	if order.Status != types.Cancelled {
		t.Fatalf("order.Status = %v, want Cancelled", order.Status)
	}
	if _, ok := book.orders[order.ID]; ok {
		t.Fatalf("cancelled order %q remains in order map", order.ID)
	}
	if bids := book.GetBids(); len(bids) != 0 {
		t.Fatalf("len(GetBids()) = %d, want 0", len(bids))
	}
}

func TestCancelMissingOrderReturnsErrOrderNotFound(t *testing.T) {
	book := testBook()

	err := book.CancelOrder("missing-order")
	if !errors.Is(err, ErrOrderNotFound) {
		t.Fatalf("CancelOrder missing error = %v, want ErrOrderNotFound", err)
	}
}

func TestAddOrderOnClosedBookReturnsErrBookClosed(t *testing.T) {
	book := testBook()
	book.Close()

	trades, err := book.AddOrder(testOrder("closed-book", types.Buy, "100.00", "1"))
	if !errors.Is(err, ErrBookClosed) {
		t.Fatalf("AddOrder closed book error = %v, want ErrBookClosed", err)
	}
	if trades != nil {
		t.Fatalf("AddOrder closed book trades = %v, want nil", trades)
	}
}
