import { GoogleGenAI, Type } from "@google/genai";
import { ProcessingResult, DocType } from "../types";

const SYSTEM_INSTRUCTION = `Bạn là chuyên gia QA/GMP ngành dược. Nhiệm vụ của bạn là trích xuất dữ liệu ĐẦY ĐỦ và trình bày theo cấu trúc phân cấp nghiêm ngặt.

QUY TẮC CẤU TRÚC 'change_content' (BẮT BUỘC):
1. Chia làm 2 mục chính: "1. ĐMVT:" và "2. QTSX:".
2. Trong mỗi mục chính, nếu có thay đổi, phải trình bày theo cụm:
   - Nội dung hiện hành:
     + [Ý nhỏ 1]
     + [Ý nhỏ 2]
   - Nội dung thay đổi:
     + [Ý nhỏ 1 mới]
     + [Ý nhỏ 2 mới]
3. QUY TẮC DẤU ĐẦU DÒNG:
   - Sử dụng dấu gạch ngang (-) cho tiêu đề mục lớn (Nội dung hiện hành/thay đổi).
   - Sử dụng dấu cộng (+) cho từng dòng nội dung chi tiết bên trong.
   - Mỗi dấu (+) phải nằm trên một dòng riêng biệt (sử dụng \n).
4. TÔ ĐẬM: Dùng **...** để bao bọc các con số, thông số hoặc từ ngữ khác biệt trong phần "Nội dung thay đổi".

QUY TẮC ĐỐI VỚI 'DE_XUAT_CAI_TIEN' (BẮT BUỘC):
- Nếu là tài liệu Đề xuất cải tiến (thường có bảng "Tôi thấy (hiện trạng)" và "Tôi đề xuất (giải pháp)"):
- Trích xuất 4 thành phần: Hiện trạng, Nhược điểm, Đề xuất (Giải pháp), Ưu điểm.
- Gộp tất cả thành 1 chuỗi văn bản duy nhất trong trường 'proposal_content'.
- Cấu trúc gộp: 
  Hiện trạng: [Nội dung trích xuất]\nNhược điểm: [Nội dung trích xuất]\nĐề xuất: [Nội dung trích xuất]\nƯu điểm: [Nội dung trích xuất]
- Sử dụng đúng tiền tố và ký tự xuống dòng (\n) giữa các phần.

QUY TẮC TRÍCH XUẤT:
- KHÔNG ĐƯỢC TÓM TẮT. Nếu tài liệu có 5 ý thay đổi, phải liệt kê đủ 5 dấu (+).
- Giữ nguyên văn bản gốc, không tự ý sửa từ ngữ chuyên môn.
- Đối với BCSPKPH: Các trường nội dung gộp thành 1 dòng, nối bằng dấu "; ".

LƯU Ý: Trả về JSON duy nhất, không giải thích.`;

export const processGmpDocument = async (base64Data: string, mimeType: string): Promise<ProcessingResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: "Trích xuất toàn bộ dữ liệu theo quy tắc đã hướng dẫn.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 15000 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            doc_type: { 
              type: Type.STRING, 
              enum: ["PHIEU_THAY_DOI", "BCSPKPH", "DE_XUAT_CAI_TIEN", "KHAC"]
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nonconformity_code: { type: Type.STRING },
                  process_step: { type: Type.STRING },
                  apply_date: { type: Type.STRING },
                  nonconformity_content: { type: Type.STRING },
                  root_cause: { type: Type.STRING },
                  corrective_action: { type: Type.STRING },
                  product_name: { type: Type.STRING },
                  batch_number: { type: Type.STRING },
                  change_content: { type: Type.STRING },
                  proposal_content: { type: Type.STRING },
                },
              },
            },
          },
          required: ["doc_type", "data"],
        },
      },
    });

    const text = response.text || "";
    return JSON.parse(text) as ProcessingResult;
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw new Error("Lỗi trích xuất. Hãy đảm bảo ảnh rõ nét và chứa đầy đủ nội dung bảng biểu.");
  }
};