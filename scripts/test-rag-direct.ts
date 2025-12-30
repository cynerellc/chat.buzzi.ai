/**
 * Direct test of RAG service (bypasses API auth)
 */
import { searchKnowledge, getRagService } from '../src/lib/knowledge/rag-service';

const COMPANY_ID = 'cb573c62-09ce-4969-a4d3-9c74ea612af8';

async function testDirectRagSearch() {
  console.log('Testing RAG search directly...\n');

  const query = 'list all apple products';
  const categories = ['products', 'business'];

  console.log(`Query: "${query}"`);
  console.log(`Categories: ${categories.join(', ')}\n`);

  try {
    // Test with reranking enabled (default)
    console.log('=== Test 1: With reranking (default) ===');
    const result1 = await searchKnowledge(query, COMPANY_ID, {
      limit: 5,
      minScore: 0.3, // Use our lowered threshold
      categories,
      rerank: true,
    });

    console.log(`Results: ${result1.chunks.length} chunks, ${result1.faqs.length} FAQs`);
    console.log(`Search time: ${result1.searchTimeMs.toFixed(0)}ms`);
    console.log(`Expanded queries: ${result1.expandedQueries?.join(', ') || 'none'}`);

    if (result1.chunks.length > 0) {
      console.log('\nChunk results:');
      result1.chunks.forEach((chunk, i) => {
        console.log(`  [${i + 1}] Score: ${chunk.score.toFixed(3)} - ${chunk.content.slice(0, 100)}...`);
      });
    } else {
      console.log('\nNo chunks found');
    }

    // Test without reranking
    console.log('\n=== Test 2: Without reranking ===');
    const result2 = await searchKnowledge(query, COMPANY_ID, {
      limit: 5,
      minScore: 0.3,
      categories,
      rerank: false,
    });

    console.log(`Results: ${result2.chunks.length} chunks, ${result2.faqs.length} FAQs`);
    console.log(`Search time: ${result2.searchTimeMs.toFixed(0)}ms`);

    if (result2.chunks.length > 0) {
      console.log('\nChunk results:');
      result2.chunks.forEach((chunk, i) => {
        console.log(`  [${i + 1}] Score: ${chunk.score.toFixed(3)} - ${chunk.content.slice(0, 100)}...`);
      });
    } else {
      console.log('\nNo chunks found');
    }

    // Build context string
    if (result1.chunks.length > 0 || result1.faqs.length > 0) {
      console.log('\n=== Context String (for LLM) ===');
      const ragService = getRagService();
      const context = ragService.buildContextString(result1);
      console.log(context.slice(0, 500) + '...');
    }

  } catch (error) {
    console.error('Error during RAG search:', error);
  }
}

testDirectRagSearch().catch(console.error);
