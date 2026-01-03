import { command } from '$app/server';
import { generateQuestionBatch } from '$lib/server/ai';

export const createQuestion = command(async () => {
	const quests = await generateQuestionBatch(20, []);

	return quests;
});
