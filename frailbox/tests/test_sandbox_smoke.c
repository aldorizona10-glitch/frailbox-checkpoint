#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../include/sandbox.h"

static int fail(const char *message)
{
    fprintf(stderr, "%s\n", message);
    return 1;
}

int main(void)
{
    sandbox_config_t config;
    memset(&config, 0, sizeof(config));
    config.type = SANDBOX_NONE;

    sandbox_t *sandbox = sandbox_create(&config);
    if (sandbox == NULL) {
        return fail("sandbox_create returned NULL");
    }

    if (sandbox_is_active(sandbox)) {
        sandbox_destroy(sandbox);
        return fail("new sandbox should not be active");
    }

    if (sandbox_apply(sandbox) != 0) {
        sandbox_destroy(sandbox);
        return fail("sandbox_apply failed for SANDBOX_NONE");
    }
    if (!sandbox_is_active(sandbox)) {
        sandbox_destroy(sandbox);
        return fail("sandbox should be active after apply");
    }

    if (sandbox_add_rule(sandbox, CAP_FILE_READ, ACTION_ALLOW) != 0) {
        sandbox_destroy(sandbox);
        return fail("sandbox_add_rule failed");
    }
    if (sandbox->config.rule_count != 1) {
        sandbox_destroy(sandbox);
        return fail("sandbox rule count did not increase");
    }
    if (sandbox_remove_rule(sandbox, CAP_FILE_READ) != 0) {
        sandbox_destroy(sandbox);
        return fail("sandbox_remove_rule failed");
    }
    if (sandbox->config.rule_count != 0) {
        sandbox_destroy(sandbox);
        return fail("sandbox rule count did not decrease");
    }

    sandbox_destroy(sandbox);
    return 0;
}
