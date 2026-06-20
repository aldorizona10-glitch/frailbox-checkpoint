#include <stdio.h>
#include <string.h>

#include "../include/arena.h"

static int fail(const char *message)
{
    fprintf(stderr, "%s\n", message);
    return 1;
}

int main(void)
{
    arena_t *arena = arena_create(4096, ARENA_ZERO_INIT);
    if (arena == NULL) {
        return fail("arena_create failed");
    }

    char *first = arena_alloc(arena, 64);
    if (first == NULL) {
        arena_destroy(arena);
        return fail("arena_alloc failed");
    }
    for (size_t i = 0; i < 64; i++) {
        if (first[i] != '\0') {
            arena_destroy(arena);
            return fail("ARENA_ZERO_INIT did not zero memory");
        }
    }
    strcpy(first, "frailbox arena smoke");

    void *aligned = arena_alloc_aligned(arena, 128, 64);
    if (aligned == NULL || ((uintptr_t)aligned % 64U) != 0U) {
        arena_destroy(arena);
        return fail("arena_alloc_aligned did not return 64-byte alignment");
    }

    arena_stats_t stats = arena_get_stats(arena);
    if (stats.allocation_count < 2 || stats.current_usage == 0) {
        arena_destroy(arena);
        return fail("arena stats were not updated");
    }
    if (!arena_contains(arena, first) || !arena_contains(arena, aligned)) {
        arena_destroy(arena);
        return fail("arena_contains did not recognize allocated pointers");
    }

    arena_reset(arena);
    stats = arena_get_stats(arena);
    if (stats.current_usage != 0) {
        arena_destroy(arena);
        return fail("arena_reset did not clear current usage");
    }

    arena_destroy(arena);
    return 0;
}
