#define _POSIX_C_SOURCE 200809L

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#include "../include/logger.h"

static int fail(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    vfprintf(stderr, fmt, args);
    va_end(args);
    fputc('\n', stderr);
    return 1;
}

static char *read_file(const char *path, size_t *out_len)
{
    struct stat st;
    if (stat(path, &st) != 0) {
        return NULL;
    }

    FILE *file = fopen(path, "rb");
    if (file == NULL) {
        return NULL;
    }

    char *data = calloc((size_t)st.st_size + 1, 1);
    if (data == NULL) {
        fclose(file);
        return NULL;
    }

    size_t len = fread(data, 1, (size_t)st.st_size, file);
    fclose(file);
    data[len] = '\0';
    *out_len = len;
    return data;
}

static int appears_on_same_physical_line(const char *data,
                                         const char *first,
                                         const char *second)
{
    const char *first_pos = strstr(data, first);
    if (first_pos == NULL) {
        return 0;
    }

    const char *line_end = strchr(first_pos, '\n');
    const char *second_pos = strstr(first_pos, second);
    return second_pos != NULL && (line_end == NULL || second_pos < line_end);
}

int main(void)
{
    char log_template[] = "/tmp/frailbox-logger-newline-XXXXXX";
    int fd = mkstemp(log_template);
    if (fd < 0) {
        return fail("mkstemp failed");
    }
    close(fd);

    setenv("LOG_FILE", log_template, 1);
    setenv("LOG_LEVEL", "debug", 1);
    setenv("LOG_MODULE", "newline-test", 1);
    setenv("LOG_NO_TIMESTAMPS", "1", 1);

    if (log_init() != 0) {
        unlink(log_template);
        return fail("log_init failed");
    }

    for (int i = 0; i < 5; i++) {
        LOG_INFO("plain-%d", i);
    }

    LOG_INFO("already-newline\n");
    LOG_INFO("embedded\nnewline");

    char long_message[8192];
    memset(long_message, 'x', sizeof(long_message) - 1);
    long_message[sizeof(long_message) - 1] = '\0';
    LOG_WARN("%s", long_message);
    LOG_ERROR("after-truncation");

    log_shutdown();

    size_t len = 0;
    char *data = read_file(log_template, &len);
    unlink(log_template);

    if (data == NULL) {
        return fail("failed to read log file");
    }

    if (len == 0 || data[len - 1] != '\n') {
        free(data);
        return fail("log file does not end with a newline");
    }

    for (int i = 0; i < 4; i++) {
        char first[32];
        char second[32];
        snprintf(first, sizeof(first), "plain-%d", i);
        snprintf(second, sizeof(second), "plain-%d", i + 1);
        if (appears_on_same_physical_line(data, first, second)) {
            free(data);
            return fail("%s and %s were written on the same physical line", first, second);
        }
    }

    if (strstr(data, "already-newline\n\n") != NULL) {
        free(data);
        return fail("message with caller-provided trailing newline produced a blank line");
    }

    const char *truncated = strstr(data, "[TRUNCATED]");
    const char *after_truncation = strstr(data, "after-truncation");
    if (truncated == NULL || after_truncation == NULL) {
        free(data);
        return fail("expected truncation marker and follow-up message");
    }

    const char *truncated_line_end = strchr(truncated, '\n');
    if (truncated_line_end == NULL || after_truncation < truncated_line_end) {
        free(data);
        return fail("message after truncated entry was joined to the truncated line");
    }

    free(data);
    return 0;
}
