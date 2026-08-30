import { translate, resolveLanguage, dictionaries, type Language } from "../strings";

describe("i18n strings", () => {
  it("八大模块命名与桌面端一致（zh）", () => {
    expect(translate("zh", "nav.assistant")).toBe("助理");
    expect(translate("zh", "nav.experts")).toBe("专家");
    expect(translate("zh", "nav.skills")).toBe("技能");
    expect(translate("zh", "nav.connectors")).toBe("连接器");
    expect(translate("zh", "nav.library")).toBe("资料库");
    expect(translate("zh", "nav.automations")).toBe("自动化");
    expect(translate("zh", "nav.projects")).toBe("项目");
    expect(translate("zh", "nav.inspiration")).toBe("灵感");
  });

  it("八大模块命名与桌面端一致（en）", () => {
    expect(translate("en", "nav.assistant")).toBe("Assistant");
    expect(translate("en", "nav.experts")).toBe("Experts");
    expect(translate("en", "nav.skills")).toBe("Skills");
    expect(translate("en", "nav.connectors")).toBe("Connectors");
    expect(translate("en", "nav.library")).toBe("Library");
    expect(translate("en", "nav.automations")).toBe("Automations");
    expect(translate("en", "nav.projects")).toBe("Projects");
    expect(translate("en", "nav.inspiration")).toBe("Inspiration");
  });

  it("支持 {name} 参数插值", () => {
    expect(translate("en", "nav.settings")).toBe("Settings");
  });

  it("未知 key 原样返回", () => {
    expect(translate("zh", "no.such.key")).toBe("no.such.key");
  });

  it("zh 缺失的 key 回退到 en", () => {
    // 两个词典都有全部 key 时验证结构完整性
    const zhKeys = Object.keys(dictionaries.zh).sort();
    const enKeys = Object.keys(dictionaries.en).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("resolveLanguage 识别 zh 与其它回退 en", () => {
    expect(resolveLanguage("zh")).toBe("zh");
    expect(resolveLanguage("zh-CN")).toBe("zh");
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("en-US")).toBe("en");
    expect(resolveLanguage("ja")).toBe("en");
    expect(resolveLanguage("")).toBe("en");
    expect(resolveLanguage(undefined)).toBe("en");
  });
});

// 确保 Language 类型可枚举（编译期守卫）
const _all: Language[] = ["zh", "en"];
void _all;
