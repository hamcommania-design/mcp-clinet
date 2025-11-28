// Brave Search MCP 서버 연결 테스트 스크립트
const config = {
  id: "brave-search",
  name: "Brave Search (뉴스 검색)",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-brave-search"],
  description: "웹 검색 및 최신 뉴스 검색 기능을 제공하는 MCP 서버",
  env: {
    // 테스트용 - 실제 API 키는 설정 페이지에서 설정해야 함
    BRAVE_API_KEY: process.env.BRAVE_API_KEY || "",
  },
};

async function testConnection() {
  console.log("🔍 Brave Search MCP 서버 연결 테스트 시작...\n");
  console.log("설정:", JSON.stringify(config, null, 2));
  console.log("\n");

  try {
    const response = await fetch("http://localhost:3000/api/mcp/test-connection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ 연결 성공!\n");
      console.log(`연결 시간: ${data.connectTime}`);
      console.log(`총 소요 시간: ${data.totalTime}\n`);
      console.log(`도구: ${data.tools.count}개`);
      if (data.tools.list.length > 0) {
        console.log("  -", data.tools.list.map((t) => t.name).join("\n  - "));
      }
      console.log(`\n프롬프트: ${data.prompts.count}개`);
      console.log(`리소스: ${data.resources.count}개`);
    } else {
      console.error("❌ 연결 실패!\n");
      console.error("오류:", data.error);
      if (data.suggestion) {
        console.error("\n💡 제안:", data.suggestion);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 테스트 중 오류 발생:", error.message);
    console.error("\n💡 서버가 실행 중인지 확인하세요: npm run dev");
    process.exit(1);
  }
}

testConnection();

