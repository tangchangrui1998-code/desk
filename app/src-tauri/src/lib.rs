use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{Manager, PhysicalPosition};

const KEYRING_SERVICE: &str = "com.tangchangrui.foedesk";
const DEEPSEEK_KEYRING_ACCOUNT: &str = "deepseek-api-key";
const DEEPSEEK_CHAT_URL: &str = "https://api.deepseek.com/chat/completions";
const OPENAI_KEYRING_ACCOUNT: &str = "openai-api-key";
const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiProviderStatus {
    configured: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AiChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct DeepSeekRequest<'a> {
    model: &'a str,
    messages: &'a [AiChatMessage],
    stream: bool,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct DeepSeekResponse {
    choices: Vec<DeepSeekChoice>,
    usage: Option<DeepSeekUsage>,
}

#[derive(Deserialize)]
struct DeepSeekChoice {
    message: DeepSeekResponseMessage,
}

#[derive(Deserialize)]
struct DeepSeekResponseMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct DeepSeekUsage {
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

#[derive(Serialize)]
struct OpenAiRequest<'a> {
    model: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    instructions: Option<&'a str>,
    input: &'a [AiChatMessage],
    max_output_tokens: u32,
    store: bool,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    output: Vec<OpenAiOutputItem>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct OpenAiOutputItem {
    content: Option<Vec<OpenAiOutputContent>>,
}

#[derive(Deserialize)]
struct OpenAiOutputContent {
    #[serde(rename = "type")]
    kind: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    input_tokens: Option<u32>,
    output_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiChatResponse {
    content: String,
    prompt_tokens: Option<u32>,
    completion_tokens: Option<u32>,
    total_tokens: Option<u32>,
}

fn deepseek_keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, DEEPSEEK_KEYRING_ACCOUNT)
        .map_err(|error| format!("无法访问系统凭据库：{error}"))
}

fn read_deepseek_api_key() -> Result<Option<String>, String> {
    match deepseek_keyring_entry()?.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("读取 DeepSeek API Key 失败：{error}")),
    }
}

fn openai_keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, OPENAI_KEYRING_ACCOUNT)
        .map_err(|error| format!("无法访问系统凭据库：{error}"))
}

fn read_openai_api_key() -> Result<Option<String>, String> {
    match openai_keyring_entry()?.get_password() {
        Ok(api_key) => Ok(Some(api_key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("读取 OpenAI API Key 失败：{error}")),
    }
}

fn validate_chat_request(model: &str, messages: &[AiChatMessage]) -> Result<(), String> {
    if model.is_empty()
        || model.len() > 100
        || !model.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '/')
        })
    {
        return Err("模型名称格式不正确。".into());
    }
    if messages.is_empty() || messages.len() > 32 {
        return Err("对话上下文数量超出限制。".into());
    }
    let mut total_characters = 0usize;
    for message in messages {
        if !matches!(message.role.as_str(), "system" | "user" | "assistant") {
            return Err("对话消息角色不正确。".into());
        }
        let length = message.content.chars().count();
        if length == 0 || length > 4_000 {
            return Err("单条对话内容超出限制。".into());
        }
        total_characters += length;
    }
    if total_characters > 24_000 {
        return Err("对话上下文过长，请清理部分历史记录。".into());
    }
    Ok(())
}

async fn request_deepseek(
    api_key: &str,
    model: &str,
    messages: &[AiChatMessage],
    max_tokens: u32,
) -> Result<AiChatResponse, String> {
    validate_chat_request(model, messages)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("无法初始化网络请求：{error}"))?;
    let response = client
        .post(DEEPSEEK_CHAT_URL)
        .bearer_auth(api_key)
        .json(&DeepSeekRequest {
            model,
            messages,
            stream: false,
            max_tokens: max_tokens.clamp(8, 600),
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "DeepSeek 响应超时，请稍后再试。".to_string()
            } else if error.is_connect() {
                "无法连接 DeepSeek，请检查网络后重试。".to_string()
            } else {
                format!("无法连接 DeepSeek：{error}")
            }
        })?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 DeepSeek 响应失败：{error}"))?;
    if !status.is_success() {
        return Err(match status.as_u16() {
            400 => "DeepSeek 拒绝了请求，请检查模型名称。".into(),
            401 => "DeepSeek API Key 无效，请重新填写。".into(),
            402 => "DeepSeek 账户余额不足。".into(),
            403 => "DeepSeek API Key 没有使用该模型的权限。".into(),
            404 => "没有找到这个 DeepSeek 模型。".into(),
            429 => "DeepSeek 请求过于频繁，请稍后再试。".into(),
            code if code >= 500 => "DeepSeek 服务暂时不可用，请稍后再试。".into(),
            code => format!("DeepSeek 请求失败（{code}）。"),
        });
    }
    let parsed: DeepSeekResponse = serde_json::from_str(&body)
        .map_err(|error| format!("DeepSeek 返回了无法识别的数据：{error}"))?;
    let content = parsed
        .choices
        .first()
        .and_then(|choice| choice.message.content.as_deref())
        .map(str::trim)
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "DeepSeek 没有返回对话内容。".to_string())?
        .to_string();
    Ok(AiChatResponse {
        content,
        prompt_tokens: parsed.usage.as_ref().and_then(|usage| usage.prompt_tokens),
        completion_tokens: parsed
            .usage
            .as_ref()
            .and_then(|usage| usage.completion_tokens),
        total_tokens: parsed.usage.as_ref().and_then(|usage| usage.total_tokens),
    })
}

async fn request_openai(
    api_key: &str,
    model: &str,
    messages: &[AiChatMessage],
    max_output_tokens: u32,
) -> Result<AiChatResponse, String> {
    validate_chat_request(model, messages)?;
    let (instructions, input) = messages
        .first()
        .filter(|message| message.role == "system")
        .map(|message| (Some(message.content.as_str()), &messages[1..]))
        .unwrap_or((None, messages));
    if input.is_empty() {
        return Err("OpenAI 请求缺少对话内容。".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| format!("无法初始化网络请求：{error}"))?;
    let response = client
        .post(OPENAI_RESPONSES_URL)
        .bearer_auth(api_key)
        .json(&OpenAiRequest {
            model,
            instructions,
            input,
            max_output_tokens: max_output_tokens.clamp(16, 600),
            store: false,
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "OpenAI 响应超时，请稍后再试。".to_string()
            } else if error.is_connect() {
                "无法连接 OpenAI，请检查网络后重试。".to_string()
            } else {
                format!("无法连接 OpenAI：{error}")
            }
        })?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("读取 OpenAI 响应失败：{error}"))?;
    if !status.is_success() {
        return Err(match status.as_u16() {
            400 => "OpenAI 拒绝了请求，请检查模型名称和账户配置。".into(),
            401 => "OpenAI API Key 无效，请重新填写。".into(),
            403 => "OpenAI API Key 没有使用该模型的权限。".into(),
            404 => "没有找到这个 OpenAI 模型。".into(),
            429 => "OpenAI 请求过于频繁或额度不足，请稍后再试。".into(),
            code if code >= 500 => "OpenAI 服务暂时不可用，请稍后再试。".into(),
            code => format!("OpenAI 请求失败（{code}）。"),
        });
    }

    let parsed: OpenAiResponse = serde_json::from_str(&body)
        .map_err(|error| format!("OpenAI 返回了无法识别的数据：{error}"))?;
    let content = parsed
        .output
        .iter()
        .filter_map(|item| item.content.as_ref())
        .flatten()
        .filter(|content| content.kind == "output_text")
        .filter_map(|content| content.text.as_deref())
        .map(str::trim)
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    if content.is_empty() {
        return Err("OpenAI 没有返回对话内容。".into());
    }
    Ok(AiChatResponse {
        content,
        prompt_tokens: parsed.usage.as_ref().and_then(|usage| usage.input_tokens),
        completion_tokens: parsed.usage.as_ref().and_then(|usage| usage.output_tokens),
        total_tokens: parsed.usage.as_ref().and_then(|usage| usage.total_tokens),
    })
}

#[tauri::command]
async fn get_deepseek_status() -> Result<AiProviderStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        read_deepseek_api_key().map(|key| AiProviderStatus {
            configured: key.is_some(),
        })
    })
    .await
    .map_err(|error| format!("读取 DeepSeek 配置失败：{error}"))?
}

#[tauri::command]
async fn save_deepseek_api_key(api_key: String) -> Result<AiProviderStatus, String> {
    let normalized = api_key.trim().to_string();
    if normalized.len() < 12 || normalized.len() > 512 {
        return Err("请输入有效的 DeepSeek API Key。".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        deepseek_keyring_entry()?
            .set_password(&normalized)
            .map_err(|error| format!("保存 DeepSeek API Key 失败：{error}"))?;
        Ok(AiProviderStatus { configured: true })
    })
    .await
    .map_err(|error| format!("保存 DeepSeek 配置失败：{error}"))?
}

#[tauri::command]
async fn delete_deepseek_api_key() -> Result<AiProviderStatus, String> {
    tauri::async_runtime::spawn_blocking(|| match deepseek_keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(AiProviderStatus { configured: false }),
        Err(error) => Err(format!("删除 DeepSeek API Key 失败：{error}")),
    })
    .await
    .map_err(|error| format!("删除 DeepSeek 配置失败：{error}"))?
}

#[tauri::command]
async fn test_deepseek_connection(model: String) -> Result<AiChatResponse, String> {
    let api_key = tauri::async_runtime::spawn_blocking(read_deepseek_api_key)
        .await
        .map_err(|error| format!("读取 DeepSeek 配置失败：{error}"))??
        .ok_or_else(|| "请先保存 DeepSeek API Key。".to_string())?;
    request_deepseek(
        &api_key,
        model.trim(),
        &[
            AiChatMessage {
                role: "system".into(),
                content: "你正在进行连接测试。".into(),
            },
            AiChatMessage {
                role: "user".into(),
                content: "只回复：连接成功".into(),
            },
        ],
        16,
    )
    .await
}

#[tauri::command]
async fn chat_with_deepseek(
    model: String,
    messages: Vec<AiChatMessage>,
) -> Result<AiChatResponse, String> {
    let api_key = tauri::async_runtime::spawn_blocking(read_deepseek_api_key)
        .await
        .map_err(|error| format!("读取 DeepSeek 配置失败：{error}"))??
        .ok_or_else(|| "尚未配置 DeepSeek API Key。".to_string())?;
    request_deepseek(&api_key, model.trim(), &messages, 320).await
}

#[tauri::command]
async fn get_openai_status() -> Result<AiProviderStatus, String> {
    tauri::async_runtime::spawn_blocking(|| {
        read_openai_api_key().map(|key| AiProviderStatus {
            configured: key.is_some(),
        })
    })
    .await
    .map_err(|error| format!("读取 OpenAI 配置失败：{error}"))?
}

#[tauri::command]
async fn save_openai_api_key(api_key: String) -> Result<AiProviderStatus, String> {
    let normalized = api_key.trim().to_string();
    if normalized.len() < 12 || normalized.len() > 512 {
        return Err("请输入有效的 OpenAI API Key。".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        openai_keyring_entry()?
            .set_password(&normalized)
            .map_err(|error| format!("保存 OpenAI API Key 失败：{error}"))?;
        Ok(AiProviderStatus { configured: true })
    })
    .await
    .map_err(|error| format!("保存 OpenAI 配置失败：{error}"))?
}

#[tauri::command]
async fn delete_openai_api_key() -> Result<AiProviderStatus, String> {
    tauri::async_runtime::spawn_blocking(|| match openai_keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(AiProviderStatus { configured: false }),
        Err(error) => Err(format!("删除 OpenAI API Key 失败：{error}")),
    })
    .await
    .map_err(|error| format!("删除 OpenAI 配置失败：{error}"))?
}

#[tauri::command]
async fn test_openai_connection(model: String) -> Result<AiChatResponse, String> {
    let api_key = tauri::async_runtime::spawn_blocking(read_openai_api_key)
        .await
        .map_err(|error| format!("读取 OpenAI 配置失败：{error}"))??
        .ok_or_else(|| "请先保存 OpenAI API Key。".to_string())?;
    request_openai(
        &api_key,
        model.trim(),
        &[
            AiChatMessage {
                role: "system".into(),
                content: "你正在进行连接测试。".into(),
            },
            AiChatMessage {
                role: "user".into(),
                content: "只回复：连接成功".into(),
            },
        ],
        64,
    )
    .await
}

#[tauri::command]
async fn chat_with_openai(
    model: String,
    messages: Vec<AiChatMessage>,
) -> Result<AiChatResponse, String> {
    let api_key = tauri::async_runtime::spawn_blocking(read_openai_api_key)
        .await
        .map_err(|error| format!("读取 OpenAI 配置失败：{error}"))??
        .ok_or_else(|| "尚未配置 OpenAI API Key。".to_string())?;
    request_openai(&api_key, model.trim(), &messages, 320).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let is_compact_window = window
                .outer_size()
                .ok()
                .zip(window.scale_factor().ok())
                .map(|(size, scale_factor)| size.width as f64 / scale_factor < 800.0)
                .unwrap_or(true);
            if is_compact_window {
                let monitor = app
                    .cursor_position()
                    .ok()
                    .and_then(|cursor| app.monitor_from_point(cursor.x, cursor.y).ok().flatten())
                    .or_else(|| app.primary_monitor().ok().flatten());
                if let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) {
                    let work_area = monitor.work_area();
                    let x = work_area.position.x
                        + ((work_area.size.width as i64 - size.width as i64) / 2) as i32;
                    let y = work_area.position.y
                        + ((work_area.size.height as i64 - size.height as i64) / 2) as i32;
                    let _ = window.set_position(PhysicalPosition::new(x, y));
                }
            }
            let _ = window.set_focus();
        }
    }));

    builder
        .invoke_handler(tauri::generate_handler![
            get_deepseek_status,
            save_deepseek_api_key,
            delete_deepseek_api_key,
            test_deepseek_connection,
            chat_with_deepseek,
            get_openai_status,
            save_openai_api_key,
            delete_openai_api_key,
            test_openai_connection,
            chat_with_openai
        ])
        .run(tauri::generate_context!())
        .expect("error while running FoeDesk");
}
