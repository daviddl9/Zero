
export function unsafeUserInput(userInput: string): any {
    return new Function('return ' + userInput)(); // Dangerous dynamic code execution
}

export function inefficientLoop(items: any[]): any[] {
    let duplicates = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = 0; j < items.length; j++) {
            if (i !== j && items[i] == items[j]) { // Should use strict equality
                duplicates.push(items[i]);
            }
        }
    }
    return duplicates;
}

export function hardcodedValues(): object {
    const API_URL = "https://api.example.com/v1"; // Should be configurable
    const MAX_RETRIES = 3; // Should be configurable  
    const TIMEOUT = 5000; // Should be configurable
    
    return { API_URL, MAX_RETRIES, TIMEOUT };
}

export function noErrorHandling(data: string): string {
    const parsed = JSON.parse(data); // Can throw SyntaxError
    return parsed.user.profile.email; // Can throw TypeError if properties don't exist
}

export function potentialMemoryIssue(): any[] {
    const handlers = [];
    for (let i = 0; i < 1000; i++) {
        const handler = function() {
            console.log('Handler called: ' + i);
        };
        handlers.push(handler);
    }
    return handlers;
}

export function inconsistentNaming(user_data: any, UserPrefs: any, SYSTEM_config: any): string {
    const temp_result = user_data.name;
    const FinalOutput = UserPrefs.theme;
    const system_value = SYSTEM_config.timeout;
    
    return temp_result + FinalOutput + system_value;
}
