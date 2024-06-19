import { test } from "@jest/globals";

import { HumanMessage } from "@langchain/core/messages";
import { ChatBaiduWenxin } from "../chat_modelsv2.js";

test("invokedefault", async () => {
  const chat = new ChatBaiduWenxin({
    baiduApiKey: 'YOUR_BAK',
    baiduSecretKey: 'YOUR_BSK'
  });
  const message = new HumanMessage("上海天气");
  const res = await chat.invoke([message]);
  console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});

test("invoke", async () => {
  const chat = new ChatBaiduWenxin({
    qianfanAccessKey: 'YOUR_AK',
    qianfanSecretKey: 'YOUR_SK',
    model: 'SQLCoder-7B',
    qianfanSDKName: 'Completions'
  });
  const message = new HumanMessage("北京天气");
  const res = await chat.invoke([message]);
  console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});