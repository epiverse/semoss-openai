import {Insight, runPixel, partial} from "https://cdn.jsdelivr.net/npm/@semoss/sdk@1.0.0-beta.25/+esm";

export default class SEMOSS {
    constructor(options = {}) {
        this.options = options;
        this.insight = null;
        this.insightId = null;
        this.initialized = false;
        this.authorized = false;

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
                this.authorized = this.insight._store.isAuthorized;

                if (!this.initialized) {
                    console.error("Failed to initialize SEMOSS SDK");
                    throw new Error("Failed to initialize SEMOSS SDK");
                }

                if (!this.authorized) {
                    console.error("Failed to authorize user on SEMOSS platform");
                    throw new Error("Failed to authorize user on SEMOSS platform");
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
        if (!this.initialized || !this.authorized) {
            await this._initialize();
        }

        if (!this.initialized) {
            throw new Error("SEMOSS SDK failed to initialize");
        }

        if (!this.authorized) {
            throw new Error("SEMOSS SDK failed to authorize user on SEMOSS platform");
        }
    }

    /**
     * Convert ChatML-style messages to SEMOSS-compatible format
     * @private
     * @param {Array} messages - Array of message objects with role and content
     * @returns {string} - Formatted content for SEMOSS
     */
    _formatMessagesForSemoss(messages) {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Messages array is empty or invalid");
        }

        const hasUserMessage = messages.some(m => m.role === 'user');
        if (!hasUserMessage) {
            throw new Error("At least one user message is required");
        }

        // Formatted conversation history
        let formattedPrompt = '';

        const systemMessages = messages.filter(m => m.role === 'system');
        if (systemMessages.length > 0) {
            formattedPrompt += `<system_prompt>\n ${systemMessages[0].content}\n</system_prompt>\n\n`;
        }

        formattedPrompt += '<conversation_history>\n';

        for (const message of messages) {
            if (message.role === 'system') continue;

            const roleName = this._getRoleName(message.role);
            formattedPrompt += `${roleName}: ${message.content}\n\n`;
        }

        formattedPrompt += '</conversation_history>\n';

        // Add final assistant prompt
        formattedPrompt += 'Assistant: ';

        return formattedPrompt;
    }

    /**
     * Get a human-readable role name for formatting
     * @private
     * @param {string} role - Role identifier ('user', 'assistant', etc.)
     * @returns {string} - Formatted role name
     */
    _getRoleName(role) {
        switch (role.toLowerCase()) {
            case 'user':
                return 'User';
            case 'assistant':
                return 'Assistant';
            case 'system':
                return 'System';
            default:
                return role.charAt(0).toUpperCase() + role.slice(1); // Capitalize first letter
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