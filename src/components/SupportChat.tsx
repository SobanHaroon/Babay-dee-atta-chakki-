import React from "react";

export function SupportChat() {
  const handleWhatsAppClick = () => {
    const message = encodeURIComponent(
      "Assalam-o-Alaikum Babay Dee Atta Chakki! I am visiting your premium e-commerce store and would like to inquire about pure organic stone-ground Atta rates and delivery in Islamabad/Rawalpindi."
    );
    window.open(`https://wa.me/923215010846?text=${message}`, "_blank");
  };

  return (
    <div id="support-chat-wrapper" className="fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-50 font-sans">
      <button
        onClick={handleWhatsAppClick}
        id="whatsapp-direct-chat-btn"
        className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white p-3.5 lg:gap-2.5 lg:px-5 lg:py-3.5 rounded-full shadow-2xl cursor-pointer transition-all duration-300 group"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 fill-current text-white group-hover:scale-110 transition-transform duration-300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.457L0 24zm6.59-4.846c1.6.95 3.172 1.45 4.814 1.453 5.457 0 9.895-4.437 9.898-9.896.002-2.644-1.025-5.13-2.892-6.997C16.59 1.848 14.108.82 11.469.82c-5.462 0-9.9 4.438-9.904 9.898-.001 1.748.46 3.454 1.334 4.965l-1.02 3.722 3.812-1.002zm11.365-7.854c-.29-.146-1.714-.847-1.98-.942-.264-.096-.456-.145-.647.144-.19.29-.738.943-.905 1.134-.167.19-.332.213-.622.068-.29-.145-1.223-.45-2.33-1.433-.86-.767-1.442-1.716-1.61-2.006-.17-.29-.018-.446.126-.59.13-.13.29-.338.435-.507.145-.17.193-.29.29-.483.097-.193.048-.36-.024-.506-.07-.146-.647-1.558-.887-2.133-.233-.56-.47-.482-.647-.49-.166-.008-.356-.01-.548-.01-.191 0-.504.071-.768.36-.264.29-1.007.986-1.007 2.402 0 1.416 1.03 2.784 1.173 2.977.144.19 2.027 3.096 4.91 4.341.685.296 1.22.473 1.637.605.689.219 1.315.188 1.81.114.553-.082 1.714-.7 1.956-1.378.243-.677.243-1.256.17-1.378-.073-.122-.265-.194-.555-.34z" />
        </svg>
        <span className="text-xs font-bold font-sans tracking-wide hidden lg:inline">Chat on WhatsApp</span>
        <span className="w-2.5 h-2.5 bg-green-500 rounded-full border border-white animate-pulse hidden lg:inline-block" />
      </button>
    </div>
  );
}
