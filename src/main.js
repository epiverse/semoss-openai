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
                return role.charAt(0).toUpperCase() + role.slice(1);
        }
    }

    /**
     * Get SEMOSS model ID from OpenAI model name
     * @private
     * @param {string} openaiModel - OpenAI model name
     * @returns {string} - SEMOSS model ID
     */
    _getSemossModelId(openaiModel) {
        const modelId = this.modelMap[openaiModel];

        if (!modelId) {
            // Default to Meta Llama 3 8B, if model not found
            return '305f694d-c91c-400f-bd6c-b7e1dfbb5a4b';
        }

        return modelId;
    }

    /**
     * Format SEMOSS response to match OpenAI response format
     * @private
     * @param {Object} semossResponse - Response from SEMOSS API
     * @returns {Object} - OpenAI-like response object
     */
    _formatSemossResponse(semossResponse) {
        // Extract the actual response text
        let responseText = 'No response received';
        let tokenCount = 0;

        if (semossResponse.pixelReturn &&
            semossResponse.pixelReturn.length > 0 &&
            semossResponse.pixelReturn[0].output) {

            const output = semossResponse.pixelReturn[0].output;

            if (typeof output === 'object' && output.response) {
                responseText = output.response;
                tokenCount = output.numberOfTokensInResponse || 0;
            } else if (typeof output === 'string') {
                responseText = output;
            }
        }

        // Create an OpenAI-like response object
        return {
            id: semossResponse.insightId || 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'semoss-llm',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: responseText
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: 0, // Need to locate this in SEMOSS response
                completion_tokens: tokenCount,
                total_tokens: tokenCount
            }
        };
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

        const {model = 'gpt-4o', messages, stream = false} = options;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new Error("Messages array is required");
        }

        const modelId = this._getSemossModelId(model);

        const content = this._formatMessagesForSemoss(messages);

        if (stream) {
            return this._createStreamingChatCompletion(modelId, content);
        }

        // For standard (non-streaming) requests
        try {
            const pixelQuery = `LLM(engine=["${modelId}"], command=["<encode>${content}</encode>"]);`;
            const result = await runPixel(pixelQuery, this.insightId);

            // Check for errors
            if (result.errors && result.errors.length > 0) {
                throw new Error(result.errors.join(', '));
            }

            // Format and return the response
            return this._formatSemossResponse(result);

        } catch (error) {
            throw new Error(`SEMOSS API Error: ${error.message}`);
        }
    }

    /**
     * Create a streaming chat completion
     * @private
     * @param {string} modelId - SEMOSS model ID
     * @param {string} content - Formatted message content
     * @returns {Object} - An object with a method to iterate through chunks
     */
    _createStreamingChatCompletion(modelId, content) {
        // Create a more compatible streaming implementation
        return {
            [Symbol.asyncIterator]: () => {
                // State for the iterator
                let isCollecting = true;
                let fullResponse = '';
                let lastResponseLength = 0;
                let intervalId = null;
                let runPixelPromise = null;
                let isComplete = false;
                let error = null;

                // Return the iterator
                return {
                    async next() {
                        // If we've encountered an error, throw it
                        if (error) {
                            throw error;
                        }

                        // If we're done, return done: true
                        if (isComplete) {
                            return {done: true, value: undefined};
                        }

                        try {
                            // If this is the first call, start the process
                            if (!runPixelPromise) {
                                // Start the query
                                const pixelQuery = `LLM(engine=["${modelId}"], command=["<encode>${content}</encode>"]);`;
                                runPixelPromise = runPixel(pixelQuery, this.insightId || window.insightId);

                                // Set up interval to check for partial responses
                                intervalId = setInterval(async () => {
                                    if (!isCollecting) return;

                                    try {
                                        const output = await partial(this.insightId);

                                        if (output.message && output.message.total) {
                                            fullResponse = output.message.total;
                                        }
                                    } catch (e) {
                                        console.error("Error collecting partial response:", e);
                                    }
                                }, 250);

                                // Wait for the initial response
                                await new Promise(resolve => setTimeout(resolve, 300));
                            }

                            // Check if we have new content
                            if (fullResponse.length > lastResponseLength) {
                                const newContent = fullResponse.substring(lastResponseLength);
                                lastResponseLength = fullResponse.length;

                                // Format as an OpenAI-like streaming chunk
                                return {
                                    done: false,
                                    value: {
                                        id: 'chatcmpl-' + Date.now(),
                                        object: 'chat.completion.chunk',
                                        created: Math.floor(Date.now() / 1000),
                                        model: 'semoss-llm',
                                        choices: [
                                            {
                                                index: 0,
                                                delta: {
                                                    content: newContent
                                                },
                                                finish_reason: null
                                            }
                                        ]
                                    }
                                };
                            }

                            // If runPixelPromise is resolved, we're done
                            const isResolved = await Promise.race([
                                runPixelPromise.then(() => true),
                                new Promise(resolve => setTimeout(() => resolve(false), 100))
                            ]);

                            if (isResolved) {
                                isCollecting = false;
                                clearInterval(intervalId);
                                isComplete = true;

                                return {
                                    done: false,
                                    value: {
                                        id: 'chatcmpl-' + Date.now(),
                                        object: 'chat.completion.chunk',
                                        created: Math.floor(Date.now() / 1000),
                                        model: 'semoss-llm',
                                        choices: [
                                            {
                                                index: 0,
                                                delta: {},
                                                finish_reason: 'stop'
                                            }
                                        ]
                                    }
                                };
                            }

                            await new Promise(resolve => setTimeout(resolve, 100));
                            return this.next();

                        } catch (e) {
                            // Save error and throw in the next call
                            error = new Error(`SEMOSS API Streaming Error: ${e.message}`);
                            isCollecting = false;
                            if (intervalId) clearInterval(intervalId);
                            throw error;
                        }
                    }
                };
            }
        };
    }
}