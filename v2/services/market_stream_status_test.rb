# frozen_string_literal: true

require 'minitest/autorun'
require_relative 'market_stream_status'

class MarketStreamStatusTest < Minitest::Test
  def test_status_json_includes_reconnect_counters_and_last_message
    started_at = Time.utc(2026, 1, 1, 0, 0, 0)
    last_message_at = Time.utc(2026, 1, 1, 0, 0, 12)
    status = MarketStreamStatus.new(started_at: started_at)

    status.record_reconnect_attempt
    status.record_reconnect_attempt
    status.record_reconnect_success
    status.record_message(3, at: last_message_at)

    parsed = JSON.parse(status.status_json(now: Time.utc(2026, 1, 1, 0, 1, 0), version: 'test'))

    assert_equal('market-stream', parsed.fetch('service'))
    assert_equal('test', parsed.fetch('version'))
    assert_equal('healthy', parsed.fetch('status'))
    assert_equal(true, parsed.fetch('connected'))
    assert_equal(60, parsed.fetch('uptime_seconds'))
    assert_equal('2026-01-01T00:00:12.000Z', parsed.fetch('last_message_timestamp'))
    assert_equal(3, parsed.fetch('messages_processed'))
    assert_equal(2, parsed.fetch('reconnect_attempts'))
    assert_equal(1, parsed.fetch('successful_reconnects'))
    assert_equal(0, parsed.fetch('dropped_messages'))
  end

  def test_fake_redis_connection_failure_is_redacted
    status = MarketStreamStatus.new(started_at: Time.utc(2026, 1, 1, 0, 0, 0))
    fake_redis_error = StandardError.new(
      'failed to connect to redis://streamer:supersecret@redis.example:6379/0?password=hunter2'
    )

    status.record_dropped_message(fake_redis_error)
    parsed = JSON.parse(status.status_json(now: Time.utc(2026, 1, 1, 0, 0, 1)))

    assert_equal('degraded', parsed.fetch('status'))
    assert_equal(1, parsed.fetch('dropped_messages'))
    refute_includes(parsed.fetch('last_error'), 'supersecret')
    refute_includes(parsed.fetch('last_error'), 'hunter2')
    assert_includes(parsed.fetch('last_error'), 'redis://[redacted]@redis.example:6379/0?password=[redacted]')
  end
end
