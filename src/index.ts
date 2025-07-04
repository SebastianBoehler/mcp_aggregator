import { ChatOpenAI } from "@langchain/openai";
import { MCPAgent, MCPClient } from "mcp-use";
import "dotenv/config";
import fs from "fs";

async function main() {
  // 1. Configure MCP servers
  const rawConfig = fs.readFileSync("mcp_servers.json", "utf-8");
  //console.log(rawConfig);
  const config = JSON.parse(rawConfig);
  const client = MCPClient.fromDict(config);

  // 2. Create LLM
  const llm = new ChatOpenAI({ modelName: "gpt-4o" });

  // 3. Instantiate agent
  const agent = new MCPAgent({ llm, client, maxSteps: 20 });

  // 4. Run query
  const result = await agent.run("Give me recommendations, availability and prices in EUR for possible domain names for my business 'hb capital'");
  console.log("Result:", result);
}

main().catch(console.error);
