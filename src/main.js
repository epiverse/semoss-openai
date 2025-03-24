import {Insight, runPixel, partial} from "https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.25/+esm";

export default class SEMOSS {
    constructor(options = {}) {
        this.options = options;
        this.insight = null;
        this.insightId = null;
        this.initialized = false;

        // This should not be hard-coded in a real-world application
        this.modelMap = {
            'Llama-3.1-8B-Instruct': '305f694d-c91c-400f-bd6c-b7e1dfbb5a4b',
            'Qwen2.5-7B-Instruct': 'a1b1b9ad-17c7-473a-9dfb-b2b8c29cdef0'
        };

        this.chat = {
            completions: {
                create: this.createChatCompletion.bind(this)
            }
        };

        // Initialize the SEMOSS SDK
        this._initialize();
    }

    /**
     * Initialize the SEMOSS SDK
     * @private
     */
    async _initialize() {
        if (!this.initialized) {
            try {
                this.insight = new Insight();
                await this.insight.initialize();
                this.insightId = this.insight._store.insightId;
                this.initialized = this.insight._store.isInitialized;

                if (!this.initialized) {
                    throw new Error("Failed to initialize SEMOSS SDK");
                }
            } catch (error) {
                console.error("Failed to initialize SEMOSS SDK:", error);
                throw new Error("Failed to initialize SEMOSS SDK: " + error.message);
            }
        }

        return this.initialized;
    }

    /**
     * Ensure the SDK is initialized before making calls
     * @private
     */
    async _ensureInitialized() {
        if (!this.initialized) {
            await this._initialize();
        }

        if (!this.initialized) {
            throw new Error("SEMOSS SDK failed to initialize");
        }
    }

    /**
     * Create a chat completion (main method, matches OpenAI API)
     * @param {Object} options - Configuration options
     * @param {string} options.model - Model to use
     * @param {Array} options.messages - Array of message objects
     * @param {boolean} options.stream - Whether to stream the response
     * @returns {Object|AsyncGenerator} - Response object or stream
     */
    async createChatCompletion(options) {
        await this._ensureInitialized();
    }
}