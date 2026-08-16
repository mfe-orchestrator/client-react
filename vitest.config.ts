import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        // The provider is rendered for real: the point of these tests is what happens across two
        // renders, which no server side render can reproduce.
        environment: "jsdom",
        include: ["test/**/*.test.tsx"],
        clearMocks: true,
        restoreMocks: true
    }
})
