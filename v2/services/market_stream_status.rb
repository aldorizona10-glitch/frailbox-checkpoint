# frozen_string_literal: true

require 'json'
require 'thread'
require 'time'

class MarketStreamStatus
  attr_accessor :connected

  def initialize(started_at: Time.now.utc)
    @started_at = started_at
    @connected = false
    @messages_processed = 0
    @reconnect_attempts = 0
    @successful_reconnects = 0
    @dropped_messages = 0
    @last_message_at = nil
    @last_error = nil
    @mutex = Mutex.new
  end

  def record_message(count = 1, at: Time.now.utc)
    @mutex.synchronize do
      @messages_processed += count
      @last_message_at = at
    end
  end

  def record_reconnect_attempt
    @mutex.synchronize do
      @reconnect_attempts += 1
    end
  end

  def record_reconnect_success
    @mutex.synchronize do
      @successful_reconnects += 1
      @connected = true
      @last_error = nil
    end
  end

  def record_disconnect(error = nil)
    @mutex.synchronize do
      @connected = false
      @last_error = sanitized_error(error) if error
    end
  end

  def record_dropped_message(error = nil)
    @mutex.synchronize do
      @dropped_messages += 1
      @last_error = sanitized_error(error) if error
    end
  end

  def record_error(error)
    @mutex.synchronize do
      @last_error = sanitized_error(error)
    end
  end

  def status_hash(now: Time.now.utc, service: 'market-stream', version: nil)
    @mutex.synchronize do
      {
        service: service,
        version: version,
        status: @connected ? 'healthy' : 'degraded',
        connected: @connected,
        uptime_seconds: (now - @started_at).to_i,
        last_message_timestamp: @last_message_at&.utc&.iso8601(3),
        messages_processed: @messages_processed,
        reconnect_attempts: @reconnect_attempts,
        successful_reconnects: @successful_reconnects,
        dropped_messages: @dropped_messages,
        last_error: @last_error,
      }.compact
    end
  end

  def status_json(now: Time.now.utc, service: 'market-stream', version: nil)
    JSON.generate(status_hash(now: now, service: service, version: version))
  end

  private

  def sanitized_error(error)
    return nil unless error

    message = error.respond_to?(:message) ? error.message.to_s : error.to_s
    sanitized = message.dup
    sanitized.gsub!(%r{(redis://)([^:@/\s]+):([^@/\s]+)@}i, '\1[redacted]@')
    sanitized.gsub!(/((?:password|passwd|pwd|token|secret)=)[^&\s]+/i, '\1[redacted]')
    sanitized.gsub!(/(AUTH\s+)[^\s]+/i, '\1[redacted]')
    sanitized
  end
end
