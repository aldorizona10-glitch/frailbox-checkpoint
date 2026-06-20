/**
 * @file test_logger_rotation.c
 * @brief Small harness for the legacy logger size-based file rotation.
 */

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#include "../include/logger.h"

#define ASSERT_TRUE(cond, msg) do { \
    if (!(cond)) { \
        fprintf(stderr, "ASSERT FAILED: %s\n", msg); \
        return -1; \
    } \
} while (0)

static int path_join(char *out, size_t out_size, const char *dir, const char *name)
{
    int written = snprintf(out, out_size, "%s/%s", dir, name);
    return written > 0 && (size_t)written < out_size ? 0 : -1;
}

static int path_with_suffix(char *out, size_t out_size, const char *path, const char *suffix)
{
    int written = snprintf(out, out_size, "%s%s", path, suffix);
    return written > 0 && (size_t)written < out_size ? 0 : -1;
}

static int file_exists(const char *path)
{
    return access(path, F_OK) == 0;
}

static long file_size(const char *path)
{
    struct stat st;
    if (stat(path, &st) != 0) {
        return -1;
    }
    return (long)st.st_size;
}

static void cleanup_logs(const char *dir, const char *base_path)
{
    char path[512];

    remove(base_path);
    for (int i = 1; i <= 4; i++) {
        snprintf(path, sizeof(path), "%s.%d", base_path, i);
        remove(path);
    }
    rmdir(dir);
}

static int make_temp_dir(char *dir_template, size_t dir_template_size)
{
    const char template[] = "/tmp/frailbox-log-rotation-XXXXXX";

    if (sizeof(template) > dir_template_size) {
        return -1;
    }
    memcpy(dir_template, template, sizeof(template));
    return mkdtemp(dir_template) == NULL ? -1 : 0;
}

static int test_rotation_and_retention(void)
{
    char dir[128];
    char log_path[512];
    char rotated[512];

    ASSERT_TRUE(make_temp_dir(dir, sizeof(dir)) == 0, "mkdtemp failed");
    ASSERT_TRUE(path_join(log_path, sizeof(log_path), dir, "runtime.log") == 0,
                "log path overflow");

    setenv("LOG_FILE", log_path, 1);
    setenv("LOG_LEVEL", "error", 1);
    setenv("LOG_NO_TIMESTAMPS", "1", 1);
    setenv("LOG_MAX_SIZE", "180", 1);
    setenv("LOG_ROTATE_FILES", "3", 1);

    ASSERT_TRUE(log_init() == 0, "log_init failed");
    for (int i = 0; i < 40; i++) {
        LOG_ERROR("rotation message %02d abcdefghijklmnopqrstuvwxyz", i);
    }
    log_shutdown();

    ASSERT_TRUE(file_exists(log_path), "active log missing");
    ASSERT_TRUE(path_with_suffix(rotated, sizeof(rotated), log_path, ".1") == 0,
                "rotated .1 path overflow");
    ASSERT_TRUE(file_exists(rotated), "first rotated log missing");
    ASSERT_TRUE(file_size(rotated) <= 180, "first rotated log exceeded limit");

    ASSERT_TRUE(path_with_suffix(rotated, sizeof(rotated), log_path, ".2") == 0,
                "rotated .2 path overflow");
    ASSERT_TRUE(file_exists(rotated), "second rotated log missing");
    ASSERT_TRUE(file_size(rotated) <= 180, "second rotated log exceeded limit");

    ASSERT_TRUE(path_with_suffix(rotated, sizeof(rotated), log_path, ".3") == 0,
                "rotated .3 path overflow");
    ASSERT_TRUE(file_exists(rotated), "third rotated log missing");
    ASSERT_TRUE(file_size(rotated) <= 180, "third rotated log exceeded limit");

    ASSERT_TRUE(path_with_suffix(rotated, sizeof(rotated), log_path, ".4") == 0,
                "rotated .4 path overflow");
    ASSERT_TRUE(!file_exists(rotated), "retention kept more than three logs");

    cleanup_logs(dir, log_path);
    return 0;
}

static int test_default_does_not_rotate(void)
{
    char dir[128];
    char log_path[512];
    char rotated[512];

    ASSERT_TRUE(make_temp_dir(dir, sizeof(dir)) == 0, "mkdtemp failed");
    ASSERT_TRUE(path_join(log_path, sizeof(log_path), dir, "runtime.log") == 0,
                "log path overflow");

    setenv("LOG_FILE", log_path, 1);
    setenv("LOG_LEVEL", "error", 1);
    setenv("LOG_NO_TIMESTAMPS", "1", 1);
    unsetenv("LOG_MAX_SIZE");
    unsetenv("LOG_ROTATE_FILES");

    ASSERT_TRUE(log_init() == 0, "log_init failed");
    for (int i = 0; i < 20; i++) {
        LOG_ERROR("default behavior message %02d abcdefghijklmnopqrstuvwxyz", i);
    }
    log_shutdown();

    ASSERT_TRUE(file_exists(log_path), "active log missing without rotation");
    ASSERT_TRUE(path_with_suffix(rotated, sizeof(rotated), log_path, ".1") == 0,
                "rotated default path overflow");
    ASSERT_TRUE(!file_exists(rotated), "default logger unexpectedly rotated");

    cleanup_logs(dir, log_path);
    return 0;
}

int main(void)
{
    if (test_rotation_and_retention() != 0) {
        return 1;
    }
    if (test_default_does_not_rotate() != 0) {
        return 1;
    }
    puts("logger rotation tests passed");
    return 0;
}
