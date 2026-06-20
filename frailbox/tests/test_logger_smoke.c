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

int main(void)
{
    char log_template[] = "/tmp/frailbox-logger-smoke-XXXXXX";
    int fd = mkstemp(log_template);
    if (fd < 0) {
        return fail("mkstemp failed");
    }
    close(fd);

    setenv("LOG_FILE", log_template, 1);
    setenv("LOG_LEVEL", "debug", 1);
    setenv("LOG_MODULE", "self-test", 1);
    setenv("LOG_NO_TIMESTAMPS", "1", 1);

    if (log_init() != 0) {
        unlink(log_template);
        return fail("log_init failed");
    }

    LOG_INFO("logger smoke started");
    LOG_WARN("logger smoke warning path");
    log_shutdown();

    size_t len = 0;
    char *data = read_file(log_template, &len);
    unlink(log_template);

    if (data == NULL) {
        return fail("failed to read log file");
    }
    if (len == 0) {
        free(data);
        return fail("log file is empty");
    }
    if (strstr(data, "logger smoke started") == NULL) {
        free(data);
        return fail("missing info log entry");
    }
    if (strstr(data, "logger smoke warning path") == NULL) {
        free(data);
        return fail("missing warning log entry");
    }

    free(data);
    return 0;
}
