import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Copy, 
  RefreshCcw, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles, 
  Target, 
  User, 
  FileText, 
  Share2, 
  Image as ImageIcon,
  Key,
  AlertCircle,
  Type,
  Cpu // [新增] 引入 Cpu 圖示供模型選單使用
} from 'lucide-react';

// --- 自定義 Markdown 渲染器 (維持不變) ---
const SimpleMarkdownRenderer = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  return (
    <div className="space-y-4 text-slate-300 leading-relaxed">
      {lines.map((line, index) => {
        if (line.startsWith('# ')) return <h1 key={index} className="text-3xl font-bold text-emerald-400 mt-6 mb-4">{line.replace('# ', '')}</h1>;
        if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-semibold text-emerald-400 mt-4 mb-2 border-l-4 border-emerald-400 pl-3">{line.replace('## ', '')}</h2>;
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <p key={index}>
              {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-bold">{part}</strong> : part)}
            </p>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
        if (line.trim() === '') return <div key={index} className="h-2" />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
};

export default function App() {
  // --- 狀態管理 ---
  const [step, setStep] = useState('INPUT'); 
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [userApiKey, setUserApiKey] = useState(''); 
  const [errorMsg, setErrorMsg] = useState('');
  
  // [新增] 管理使用者選擇的模型，預設使用最穩定的 2.5 Flash
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash'); 
  
  const [formData, setFormData] = useState({
    productName: '極限燃脂蛋白粉',
    features: '低熱量、高吸收率、添加維生素B群、巧克力口味。',
    targetAudience: '25-40歲，追求高效率增肌減脂的上班族。',
    referenceUrl: 'https://example-fitness.com/protein',
    seoWordCount: '600-800', 
    personaRole: '陽光健身教練',
    personaPosition: '專業營養師與私人教練',
    personaStyle: '充滿動力、熱情、口語化且具備極強的鼓勵性。'
  });

  const [result, setResult] = useState(null);

  // --- 工具函式 (維持不變) ---
  const cleanJsonString = (str) => {
    try {
      let jsonStr = str.match(/```json\n?([\s\S]*?)\n?```/) || str.match(/\{[\s\S]*\}/);
      jsonStr = jsonStr ? (jsonStr[1] || jsonStr[0]) : str;
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
      return jsonStr;
    } catch (e) {
      console.error("JSON 清理失敗:", e);
      return str;
    }
  };

  const handleCopy = (text, id) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('無法複製', err);
    }
    document.body.removeChild(textArea);
  };

  // --- API 請求與指數退避機制 ---
  // [修改] 將 url 內的模型型號改為動態變數 ${selectedModel}
  const generateWithRetry = async (prompt, retryCount = 0) => {
    const finalKey = userApiKey.trim();
    
    if (!finalKey) {
      throw new Error("請提供有效的 API 金鑰。");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${finalKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        if (response.status >= 500 && retryCount < 5) throw new Error('Server Error');
        const errData = await response.json();
        throw new Error(errData.error?.message || "請求失敗");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("回傳內容為空");
      return text;
    } catch (error) {
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateWithRetry(prompt, retryCount + 1);
      }
      throw error;
    }
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    setLoading(true);

    const systemPrompt = `
你是一位資深的內容行銷專家與創意總監。你的任務是生成行銷資產包。
請務必回傳格式正確、不含多餘逗號的 JSON。

# 商品資訊
- 名稱：${formData.productName}
- 特色：${formData.features}
- 目標受眾：${formData.targetAudience}
- 參考網址：${formData.referenceUrl}

# 需求設定
- SEO 文案字數指定：${formData.seoWordCount} 字

# 品牌人格 (Persona)
- 角色：${formData.personaRole}
- 定位：${formData.personaPosition}
- 風格：${formData.personaStyle}

# Output Format (JSON Only)
必須嚴格輸出以下 JSON 格式，不要包含任何前言或後記：
{
  "seoCopy": "Markdown 格式長文 (字數約 ${formData.seoWordCount} 字，嚴禁 Emoji, 標題 -> 痛點共鳴 -> 產品解析 -> 具體應用 -> 結語)",
  "socialMediaCopy": ["貼文1", "貼文2", "貼文3"],
  "imagePrompts": ["English AI Image Prompt 1", "Prompt 2", "Prompt 3"]
}
    `;

    try {
      const rawText = await generateWithRetry(systemPrompt);
      const cleanedJson = cleanJsonString(rawText);
      const parsedData = JSON.parse(cleanedJson);
      
      setResult(parsedData);
      setStep('RESULT');
    } catch (error) {
      console.error("生成失敗:", error);
      setErrorMsg(`生成失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- UI 組件 ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <header className="flex items-center gap-3 mb-8">
          <div className="bg-cyan-500 p-2 rounded-lg">
            <Sparkles className="text-slate-900" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI 行銷文案產生器</h1>
            <p className="text-slate-400 text-sm">自動化行銷資產包</p>
          </div>
        </header>

        {errorMsg && (
          <div className="mb-6 bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-200">
            <AlertCircle size={20} />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'INPUT' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* 核心資訊區塊 (維持不變) */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-2 mb-4 text-cyan-400">
                  <Target size={20} />
                  <h2 className="font-semibold text-lg">核心資訊</h2>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">商品名稱</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-cyan-500 transition-colors"
                        value={formData.productName}
                        onChange={e => setFormData({...formData, productName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                        <Type size={14} className="text-emerald-400" />
                        SEO 文案預計字數
                      </label>
                      <input 
                        type="text" 
                        placeholder="例如: 600-800"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-emerald-500 transition-colors text-emerald-400 font-medium"
                        value={formData.seoWordCount}
                        onChange={e => setFormData({...formData, seoWordCount: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">主要特色</label>
                    <textarea 
                      rows="3"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-cyan-500 transition-colors"
                      value={formData.features}
                      onChange={e => setFormData({...formData, features: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">目標受眾</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-cyan-500 transition-colors"
                        value={formData.targetAudience}
                        onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">參考網址 (選填)</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-cyan-500 transition-colors"
                        value={formData.referenceUrl}
                        onChange={e => setFormData({...formData, referenceUrl: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* [重構] API 與模型設定區塊 */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-2 mb-4 text-yellow-400">
                  <Key size={20} />
                  <h2 className="font-semibold text-lg">API 與環境設定</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Gemini API Key</label>
                    <input 
                      type="password" 
                      placeholder="在此貼上您的 API Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-yellow-500 transition-colors"
                      value={userApiKey}
                      onChange={e => setUserApiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1">
                      <Cpu size={14} className="text-yellow-400" />
                      驅動模型 (Model)
                    </label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-yellow-500 transition-colors text-slate-200"
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (穩定首選，能力全面)</option>
                      <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (極速輕量，最省成本)</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (最新技術，預覽版)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 品牌人格區塊 (維持不變) */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <div className="flex items-center gap-2 mb-4 text-emerald-400">
                <User size={20} />
                <h2 className="font-semibold text-lg">品牌人格</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">角色定位</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={formData.personaRole}
                    onChange={e => setFormData({...formData, personaRole: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">專業職稱</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={formData.personaPosition}
                    onChange={e => setFormData({...formData, personaPosition: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">語氣與風格</label>
                  <textarea 
                    rows="4"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-emerald-500 transition-colors"
                    value={formData.personaStyle}
                    onChange={e => setFormData({...formData, personaStyle: e.target.value})}
                  />
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCcw className="animate-spin" /> : <Send size={20} />}
                  {loading ? '生成中，請稍候...' : '立即生成行銷資產'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* RESULT 區塊 (完全不變) */
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              <div className="bg-emerald-900/30 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FileText size={20} />
                  <span className="font-bold">SEO 部落格長文 (約 {formData.seoWordCount} 字)</span>
                </div>
                <button 
                  onClick={() => handleCopy(result.seoCopy, 'seo')}
                  className="flex items-center gap-1 text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-md transition-colors"
                >
                  {copiedId === 'seo' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                  {copiedId === 'seo' ? '已複製' : '複製全文'}
                </button>
              </div>
              <div className="p-8">
                <SimpleMarkdownRenderer content={result.seoCopy} />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="bg-cyan-900/30 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Share2 size={20} />
                    <span className="font-bold">社群貼文包</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {result.socialMediaCopy.map((post, i) => (
                    <div key={i} className="group relative bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
                      <p className="text-slate-300 text-sm whitespace-pre-wrap">{post}</p>
                      <button 
                        onClick={() => handleCopy(post, `social-${i}`)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-slate-800 p-2 rounded-lg transition-all"
                      >
                        {copiedId === `social-${i}` ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="bg-violet-900/30 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-violet-400">
                    <ImageIcon size={20} />
                    <span className="font-bold">AI 圖像提示詞 (英文)</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {result.imagePrompts.map((prompt, i) => (
                    <div key={i} className="group relative bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 hover:border-violet-500/50 transition-colors">
                      <p className="text-slate-400 italic text-sm">{prompt}</p>
                      <button 
                        onClick={() => handleCopy(prompt, `prompt-${i}`)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-slate-800 p-2 rounded-lg transition-all"
                      >
                        {copiedId === `prompt-${i}` ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-4">
              <button 
                onClick={() => setStep('INPUT')}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-4 rounded-xl font-bold transition-all"
              >
                <ArrowLeft size={20} />
                返回修改資料
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 py-4 rounded-xl font-bold transition-all shadow-lg"
              >
                <RefreshCcw size={20} />
                重新生成所有內容
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
