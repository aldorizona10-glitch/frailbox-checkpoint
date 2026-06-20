CC = gcc
UNAME_S := $(shell uname -s)
CFLAGS = -Wall -Wextra -Wpedantic -std=c2x -O2 -g
CFLAGS += -D_FORTIFY_SOURCE=3
CFLAGS += -fstack-protector-strong
CFLAGS += -fPIE
LDFLAGS =
ifeq ($(UNAME_S),Linux)
LDFLAGS += -pie -z relro -z now
endif

SRCDIR = src
INCDIR = include
BUILDDIR = build

SRCS = $(wildcard $(SRCDIR)/*.c) main.c
OBJS = $(patsubst %.c, $(BUILDDIR)/%.o, $(SRCS))
DEPS = $(OBJS:.o=.d)

TARGET = frailbox
SELFTEST_BUILDDIR = $(BUILDDIR)/self-test
CONNECTOR_SELFTEST = $(SELFTEST_BUILDDIR)/test_connector
ARENA_SELFTEST = $(SELFTEST_BUILDDIR)/test_arena_smoke
LOGGER_SELFTEST = $(SELFTEST_BUILDDIR)/test_logger_smoke
SANDBOX_SELFTEST = $(SELFTEST_BUILDDIR)/test_sandbox_smoke

.PHONY: all clean self-test

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -I$(INCDIR) $^ -o $@ $(LDFLAGS)

$(BUILDDIR)/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(INCDIR) -MMD -MP -c $< -o $@

-include $(DEPS)

clean:
	rm -rf $(BUILDDIR) $(TARGET)

distclean: clean
	rm -rf *.o *.d

test: $(TARGET)
	./$(TARGET) --sandbox-type seccomp --memory-limit 64 --verbose

$(CONNECTOR_SELFTEST): tests/test_connector.c connector/api.c connector/protocol.c connector/api.h connector/protocol.h
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -Iconnector tests/test_connector.c connector/api.c connector/protocol.c -o $@ -lpthread

$(ARENA_SELFTEST): tests/test_arena_smoke.c $(SRCDIR)/arena.c $(INCDIR)/arena.h
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(INCDIR) tests/test_arena_smoke.c $(SRCDIR)/arena.c -o $@

$(LOGGER_SELFTEST): tests/test_logger_smoke.c $(SRCDIR)/logger.c $(INCDIR)/logger.h
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(INCDIR) tests/test_logger_smoke.c $(SRCDIR)/logger.c -o $@ -lpthread

$(SANDBOX_SELFTEST): tests/test_sandbox_smoke.c $(SRCDIR)/sandbox.c $(INCDIR)/sandbox.h
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(INCDIR) tests/test_sandbox_smoke.c $(SRCDIR)/sandbox.c -o $@

self-test: $(TARGET) $(CONNECTOR_SELFTEST) $(ARENA_SELFTEST) $(LOGGER_SELFTEST) $(SANDBOX_SELFTEST)
	sh tests/run_self_test.sh $(CONNECTOR_SELFTEST) $(ARENA_SELFTEST) $(LOGGER_SELFTEST) $(SANDBOX_SELFTEST)

valgrind: $(TARGET)
	valgrind --leak-check=full --show-leak-kinds=all ./$(TARGET)

.PHONY: all clean distclean test self-test valgrind
