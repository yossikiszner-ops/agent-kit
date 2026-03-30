/**
 * bricks/personas/index.js
 *
 * This folder is where you can store custom persona files
 * for your specific agent use case.
 *
 * The built-in personas (assistant, researcher, coder, tutor, sales, support)
 * are defined in core/persona.js.
 *
 * To add a custom persona:
 *
 * 1. Create a file here, e.g. bricks/personas/chef.js:
 *
 *    export const persona = `
 *      You are an expert chef with 20 years of experience in Indian cuisine.
 *      You help users cook delicious meals with ingredients they have at home.
 *      You explain cooking techniques simply and suggest substitutions when needed.
 *    `;
 *
 * 2. Import and register it in core/persona.js:
 *
 *    import { persona as chefPersona } from "@/bricks/personas/chef.js";
 *    const PERSONAS = {
 *      // ... existing personas
 *      chef: chefPersona,
 *    };
 *
 * 3. Select it in agent.config.js:
 *
 *    persona: "chef"
 *
 * Or skip the persona system entirely and write your own system prompt:
 *
 *    systemPrompt: `You are Aria, an expert in...`
 */

export {};
