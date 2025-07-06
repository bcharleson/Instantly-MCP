export declare const enhancedCreateCampaignTool: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name: {
                type: string;
                description: string;
            };
            subject: {
                type: string;
                description: string;
            };
            body: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            email_list: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            schedule_name: {
                type: string;
                description: string;
            };
            timing_from: {
                type: string;
                description: string;
            };
            timing_to: {
                type: string;
                description: string;
            };
            timezone: {
                type: string;
                description: string;
                enum: string[];
            };
            days: {
                type: string;
                description: string;
                properties: {
                    monday: {
                        type: string;
                        description: string;
                    };
                    tuesday: {
                        type: string;
                        description: string;
                    };
                    wednesday: {
                        type: string;
                        description: string;
                    };
                    thursday: {
                        type: string;
                        description: string;
                    };
                    friday: {
                        type: string;
                        description: string;
                    };
                    saturday: {
                        type: string;
                        description: string;
                    };
                    sunday: {
                        type: string;
                        description: string;
                    };
                };
            };
            sequence_steps: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
            };
            step_delay_days: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
            };
            text_only: {
                type: string;
                description: string;
            };
            daily_limit: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
            };
            email_gap_minutes: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
            };
            link_tracking: {
                type: string;
                description: string;
            };
            open_tracking: {
                type: string;
                description: string;
            };
            stop_on_reply: {
                type: string;
                description: string;
            };
            stop_on_auto_reply: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const enhancedListAccountsTool: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            limit: {
                type: string;
                description: string;
                minimum: number;
                maximum: number;
            };
            starting_after: {
                type: string;
                description: string;
            };
        };
    };
};
