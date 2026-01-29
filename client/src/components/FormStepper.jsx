import React from 'react';

const FormStepper = ({ currentStep }) => {
  const steps = [
    { num: 1, title: 'Category' },
    { num: 2, title: 'Details' },
    { num: 3, title: 'Review' }
  ];

  return (
    <div className="w-full mb-10">
      <div className="flex items-center justify-between relative max-w-2xl mx-auto">
        {/* Background Line */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
        
        {/* Active Line Progress */}
        <div 
            className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-ku-main -z-10 rounded transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step) => {
            const isActive = currentStep >= step.num;
            const isCurrent = currentStep === step.num;

            return (
                <div key={step.num} className="flex flex-col items-center gap-2 bg-white px-2">
                    <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
                        ${isActive 
                            ? 'bg-ku-main border-ku-main text-white shadow-lg scale-110' 
                            : 'bg-white border-gray-300 text-gray-400'}`}
                    >
                        {step.num}
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-ku-main' : 'text-gray-400'}`}>
                        {step.title}
                    </span>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default FormStepper;