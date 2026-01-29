import React, { useState } from 'react';
import FormStepper from '../../components/FormStepper'; // อย่าลืมแก้ path ให้ถูก
import { ArrowRight, ArrowLeft, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateTicket = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({ category: '', title: '', description: '' });

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(curr => curr + 1);
    else navigate('/student/dashboard'); // Submit เสร็จกลับหน้าหลัก
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-ku-main mb-6 text-center">New Application</h1>
      
      {/* 1. ใส่ Stepper Component ที่เราทำไว้ */}
      <FormStepper currentStep={currentStep} />

      {/* Form Content Container */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
        
        {/* Step 1: Category Selection */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Select Award Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Academic', 'Innovation', 'Activity'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFormData({ ...formData, category: cat })}
                  className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md
                    ${formData.category === cat 
                      ? 'border-ku-main bg-ku-light text-ku-main ring-1 ring-ku-main' 
                      : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <span className="font-bold text-lg block mb-2">{cat}</span>
                  <span className="text-xs text-gray-500">Click to select</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details Form */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Project Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-ku-main outline-none"
                placeholder="Ex. AI for Durian Grading"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Abstract</label>
              <textarea 
                rows="5"
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-ku-main outline-none"
                placeholder="Describe your project..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            {/* File Upload Mock */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:bg-gray-50">
                <UploadCloud className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-sm text-gray-500">Click to upload Evidence (PDF, JPG)</p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 3 && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Submit?</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Please review your information. Once submitted, you cannot edit the application until it is verified.
            </p>
            <div className="mt-6 bg-gray-50 p-4 rounded-lg text-left max-w-md mx-auto text-sm">
                <p><strong>Category:</strong> {formData.category}</p>
                <p><strong>Title:</strong> {formData.title}</p>
            </div>
          </div>
        )}

      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button 
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
            ${currentStep === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <ArrowLeft size={20} /> Back
        </button>

        <button 
          onClick={handleNext}
          className="flex items-center gap-2 bg-ku-main text-white px-8 py-3 rounded-lg hover:bg-green-800 transition shadow-lg font-medium"
        >
          {currentStep === 3 ? 'Confirm Submit' : 'Next Step'} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default CreateTicket;