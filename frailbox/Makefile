CC = gcc
CFLAGS = -Wall -Wextra -Wpedantic -std=c2x -O2 -g
CFLAGS += -D_FORTIFY_SOURCE=3
CFLAGS += -fstack-protector-strong
CFLAGS += -fPIE
LDFLAGS = -pie -z relro -z now

SRCDIR = src
INCDIR = include
BUILDDIR = build

SRCS = $(wildcard $(SRCDIR)/*.c) main.c
OBJS = $(patsubst %.c, $(BUILDDIR)/%.o, $(SRCS))
DEPS = $(OBJS:.o=.d)

TARGET = frailbox

.PHONY: all clean test-logger-newline

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

$(BUILDDIR)/tests/test_logger_newline: tests/test_logger_newline.c $(SRCDIR)/logger.c $(INCDIR)/logger.h
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -I$(INCDIR) tests/test_logger_newline.c $(SRCDIR)/logger.c -o $@ -lpthread

test-logger-newline: $(BUILDDIR)/tests/test_logger_newline
	./$(BUILDDIR)/tests/test_logger_newline

valgrind: $(TARGET)
	valgrind --leak-check=full --show-leak-kinds=all ./$(TARGET)

.PHONY: all clean distclean test valgrind test-logger-newline
