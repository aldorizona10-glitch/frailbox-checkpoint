package replay

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strings"

	"github.com/shopspring/decimal"
	"github.com/tent-of-trials/market/matching"
	"github.com/tent-of-trials/market/orderbook"
	"github.com/tent-of-trials/market/types"
)

type Fixture struct {
	Name     string          `json:"name"`
	Symbol   types.Symbol    `json:"symbol"`
	Events   []Event         `json:"events"`
	Expected ExpectedOutcome `json:"expected"`
}

type Event struct {
	Type   string       `json:"type"`
	Order  *OrderEvent  `json:"order,omitempty"`
	Cancel *CancelEvent `json:"cancel,omitempty"`
	Trade  *TradeEvent  `json:"trade,omitempty"`
}

type OrderEvent struct {
	ID       string `json:"id"`
	Side     string `json:"side"`
	Type     string `json:"type"`
	Price    string `json:"price"`
	Quantity string `json:"quantity"`
}

type CancelEvent struct {
	OrderID string `json:"order_id"`
}

type TradeEvent struct {
	ID          string `json:"id"`
	BuyOrderID  string `json:"buy_order_id"`
	SellOrderID string `json:"sell_order_id"`
	Price       string `json:"price"`
	Quantity    string `json:"quantity"`
	TakerSide   string `json:"taker_side"`
}

type ExpectedOutcome struct {
	Snapshot  Snapshot          `json:"snapshot"`
	Statuses  map[string]string `json:"statuses,omitempty"`
	Trades    []TradeEvent      `json:"trades,omitempty"`
	Analytics AnalyticsOutcome  `json:"analytics,omitempty"`
}

type AnalyticsOutcome struct {
	BufferedSamples int `json:"buffered_samples"`
}

type AnalyticsStats struct {
	BufferedSamples int
}

type Snapshot struct {
	Bids []Level `json:"bids"`
	Asks []Level `json:"asks"`
}

type Level struct {
	Price    string `json:"price"`
	Quantity string `json:"quantity"`
	Count    int64  `json:"count"`
}

type Result struct {
	Fixture        *Fixture
	Book           *orderbook.OrderBook
	Engine         *matching.MatchingEngine
	Snapshot       Snapshot
	Statuses       map[string]string
	Trades         []TradeEvent
	Analytics      AnalyticsStats
	LastEventIndex int
}

func LoadFile(path string) (*Fixture, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var fixture Fixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		return nil, fmt.Errorf("decode fixture %s: %w", path, err)
	}
	if fixture.Symbol == "" {
		return nil, fmt.Errorf("fixture %s: symbol is required", path)
	}
	return &fixture, nil
}

func ReplayFile(path string) (*Result, error) {
	fixture, err := LoadFile(path)
	if err != nil {
		return nil, err
	}
	return ReplayFixture(fixture)
}

func ReplayFixture(fixture *Fixture) (*Result, error) {
	book := orderbook.NewOrderBook(fixture.Symbol, orderbook.Config{
		MaxDepth:       100,
		PriceDecimals:  8,
		VolumeDecimals: 8,
	})
	engine := matching.NewMatchingEngine(matching.EngineConfig{
		EnableShorting: true,
	}, map[types.Symbol]*orderbook.OrderBook{
		fixture.Symbol: book,
	})

	result := &Result{
		Fixture:        fixture,
		Book:           book,
		Engine:         engine,
		Statuses:       make(map[string]string),
		Trades:         make([]TradeEvent, 0),
		LastEventIndex: -1,
	}

	for index, event := range fixture.Events {
		result.LastEventIndex = index
		switch event.Type {
		case "order":
			if event.Order == nil {
				return nil, eventError(index, event.Type, "missing order payload")
			}
			order, err := buildOrder(fixture.Symbol, *event.Order)
			if err != nil {
				return nil, eventError(index, event.Type, err.Error())
			}
			if err := engine.ValidateOrder(order); err != nil {
				return nil, eventError(index, event.Type, err.Error())
			}
			if _, err := engine.PlaceOrder(order); err != nil {
				return nil, eventError(index, event.Type, err.Error())
			}
			result.Statuses[order.ID] = statusString(order.Status)
			result.Analytics.BufferedSamples++
		case "cancel":
			if event.Cancel == nil {
				return nil, eventError(index, event.Type, "missing cancel payload")
			}
			if err := engine.CancelOrder(fixture.Symbol, event.Cancel.OrderID); err != nil {
				return nil, eventError(index, event.Type, err.Error())
			}
			result.Statuses[event.Cancel.OrderID] = "cancelled"
			result.Analytics.BufferedSamples++
		case "trade":
			if event.Trade == nil {
				return nil, eventError(index, event.Type, "missing trade payload")
			}
			if err := validateTrade(*event.Trade); err != nil {
				return nil, eventError(index, event.Type, err.Error())
			}
			result.Trades = append(result.Trades, *event.Trade)
			result.Analytics.BufferedSamples++
		default:
			return nil, eventError(index, event.Type, "unknown event type")
		}
	}

	result.Snapshot = snapshotFromBook(book)
	return result, nil
}

func ValidateExpected(result *Result) error {
	expected := result.Fixture.Expected
	eventIndex := result.LastEventIndex
	if !reflect.DeepEqual(expected.Snapshot, result.Snapshot) {
		return fmt.Errorf("event %d final snapshot mismatch: expected %+v, actual %+v",
			eventIndex, expected.Snapshot, result.Snapshot)
	}
	if expected.Statuses != nil && !reflect.DeepEqual(expected.Statuses, result.Statuses) {
		return fmt.Errorf("event %d final statuses mismatch: expected %+v, actual %+v",
			eventIndex, expected.Statuses, result.Statuses)
	}
	if expected.Trades != nil && !reflect.DeepEqual(expected.Trades, result.Trades) {
		return fmt.Errorf("event %d final trades mismatch: expected %+v, actual %+v",
			eventIndex, expected.Trades, result.Trades)
	}
	if expected.Analytics.BufferedSamples != 0 &&
		expected.Analytics.BufferedSamples != result.Analytics.BufferedSamples {
		return fmt.Errorf("event %d final analytics mismatch: expected buffered_samples=%d, actual buffered_samples=%d",
			eventIndex, expected.Analytics.BufferedSamples, result.Analytics.BufferedSamples)
	}
	return nil
}

func buildOrder(symbol types.Symbol, event OrderEvent) (*types.Order, error) {
	side, err := parseSide(event.Side)
	if err != nil {
		return nil, err
	}
	orderType, err := parseOrderType(event.Type)
	if err != nil {
		return nil, err
	}
	price, err := parseDecimal("price", event.Price)
	if err != nil {
		return nil, err
	}
	quantity, err := parseDecimal("quantity", event.Quantity)
	if err != nil {
		return nil, err
	}

	return &types.Order{
		ID:           event.ID,
		Symbol:       symbol,
		Side:         side,
		Type:         orderType,
		Price:        price,
		Quantity:     quantity,
		RemainingQty: quantity,
		LeavesQty:    quantity,
		TimeInForce:  types.GTC,
	}, nil
}

func validateTrade(event TradeEvent) error {
	if event.ID == "" {
		return fmt.Errorf("trade id is required")
	}
	if event.BuyOrderID == "" || event.SellOrderID == "" {
		return fmt.Errorf("trade order ids are required")
	}
	if _, err := parseDecimal("trade price", event.Price); err != nil {
		return err
	}
	if _, err := parseDecimal("trade quantity", event.Quantity); err != nil {
		return err
	}
	if _, err := parseSide(event.TakerSide); err != nil {
		return err
	}
	return nil
}

func parseSide(value string) (types.OrderSide, error) {
	switch strings.ToLower(value) {
	case "buy":
		return types.Buy, nil
	case "sell":
		return types.Sell, nil
	default:
		return types.Buy, fmt.Errorf("unsupported side %q", value)
	}
}

func parseOrderType(value string) (types.OrderType, error) {
	switch strings.ToLower(value) {
	case "limit":
		return types.Limit, nil
	case "market":
		return types.Market, nil
	default:
		return types.Limit, fmt.Errorf("unsupported order type %q", value)
	}
}

func parseDecimal(field string, value string) (decimal.Decimal, error) {
	parsed, err := decimal.NewFromString(value)
	if err != nil {
		return decimal.Zero, fmt.Errorf("invalid %s %q: %w", field, value, err)
	}
	return parsed, nil
}

func snapshotFromBook(book *orderbook.OrderBook) Snapshot {
	snapshot := book.GetSnapshot()
	return Snapshot{
		Bids: levelsFromBook(snapshot.Bids),
		Asks: levelsFromBook(snapshot.Asks),
	}
}

func levelsFromBook(levels []types.Level) []Level {
	result := make([]Level, 0, len(levels))
	for _, level := range levels {
		result = append(result, Level{
			Price:    level.Price.String(),
			Quantity: level.Quantity.String(),
			Count:    level.Count,
		})
	}
	return result
}

func statusString(status types.OrderStatus) string {
	switch status {
	case types.New:
		return "new"
	case types.PartiallyFilled:
		return "partially_filled"
	case types.Filled:
		return "filled"
	case types.Cancelled:
		return "cancelled"
	case types.Rejected:
		return "rejected"
	case types.Expired:
		return "expired"
	default:
		return "unknown"
	}
}

func eventError(index int, eventType string, message string) error {
	return fmt.Errorf("event %d (%s): %s", index, eventType, message)
}
