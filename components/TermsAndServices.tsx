"use client";

import React from "react";

interface TermsAndServicesProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export default function TermsAndServices({ onAccept, onDecline }: TermsAndServicesProps) {
  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-2xl mx-auto my-8">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-extrabold text-slate-900">Terms and Conditions</h2>
        <p className="text-sm font-bold text-[#0E4B5A] mt-1">J4 Clinic Digital Health Management System</p>
        <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Last updated: January 22, 2026</p>
      </div>
      
      <div className="h-96 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600 leading-relaxed shadow-inner space-y-6">
        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">1. Acceptance of Terms</h3>
          <p>
            By accessing and using the J4 Clinic Digital Health Management System, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. This agreement is effective as of your first use of our system.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">2. System Services and Features</h3>
          
          <div className="space-y-4 ml-2">
            <div>
              <p className="font-bold text-slate-800 text-xs uppercase mb-1">2.1 Patient Services</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Appointment Booking System</li>
                <li>Automatic Patient ID generation for new registrations</li>
                <li>Personal details management and verification</li>
                <li>Flexible date and time selection</li>
                <li>Detailed reason for visit documentation</li>
                <li>Easy appointment rebooking capabilities</li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-slate-800 text-xs uppercase mb-1">2.2 Medical Record Management</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Comprehensive Health Records</li>
                <li>Complete medical history documentation</li>
                <li>Growth milestones tracking</li>
                <li>Vaccination history and scheduling</li>
                <li>Current symptoms assessment</li>
                <li>Professional diagnosis recording</li>
                <li>Detailed treatment plan development</li>
              </ul>
            </div>

            <div>
              <p className="font-bold text-slate-800 text-xs uppercase mb-1">2.3 Inventory Management</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Medical Supplies Tracking</li>
                <li>Comprehensive item cataloging by name and category</li>
                <li>Real-time stock quantity monitoring</li>
                <li>Usage tracking for vaccines and medical supplies</li>
                <li>Automated low stock notifications</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">3. User Responsibilities and Access</h3>
          <div className="space-y-3">
            <div>
              <p className="font-bold text-slate-800">Patient Access</p>
              <p>Patients are granted access to appointment booking, personal health record viewing, and communication features. You are responsible for maintaining accurate personal information and attending scheduled appointments.</p>
            </div>
            <div>
              <p className="font-bold text-slate-800">Medical Staff Access</p>
              <p>Licensed medical professionals have full access to patient records, diagnosis tools, treatment planning, and prescription management. All medical decisions must comply with professional standards and regulations.</p>
            </div>
            <div>
              <p className="font-bold text-slate-800">Administrative Staff Access</p>
              <p>Administrative personnel can manage appointments, inventory, billing processes, and system notifications. Staff must maintain confidentiality and data security at all times.</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">4. Automated System Features</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Smart Notifications:</strong> Automatic alerts for appointments and inventory</li>
            <li><strong>Record Archiving:</strong> Automatic archival after 2 years of inactivity</li>
            <li><strong>Billing Processing:</strong> Streamlined payment and invoice generation</li>
            <li><strong>Report Generation:</strong> Comprehensive medical and financial reports</li>
          </ul>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">5. Privacy and Data Protection</h3>
          <p>
            We are committed to protecting your personal and medical information in accordance with HIPAA regulations and applicable privacy laws. All data transmission is encrypted, and access is restricted to authorized personnel only. Patient records are maintained with the highest level of security and confidentiality.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">6. Billing and Payment Terms</h3>
          <p>
            Our automated billing system processes payments securely and generates detailed invoices. Payment is due upon receipt of services unless prior arrangements have been made. We accept various payment methods and provide transparent pricing for all services.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">7. System Availability and Maintenance</h3>
          <p>
            While we strive to maintain 24/7 system availability, scheduled maintenance may occasionally interrupt service. Users will be notified in advance of any planned downtime. Emergency medical situations should always be handled through appropriate emergency services.
          </p>
        </section>

        <section>
          <h3 className="font-bold text-slate-900 mb-2 underline underline-offset-4 decoration-slate-200">8. Modification of Terms</h3>
          <p>
            J4 Clinic reserves the right to modify these terms and conditions at any time. Users will be notified of significant changes, and continued use of the system constitutes acceptance of the updated terms.
          </p>
        </section>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <input 
          type="checkbox" 
          id="terms-agree" 
          className="h-4 w-4 rounded border-slate-300 text-[#0E4B5A] focus:ring-[#0E4B5A]" 
        />
        <label htmlFor="terms-agree" className="text-sm text-slate-700 cursor-pointer select-none">
          I have read and agree to the <span className="text-[#0E4B5A] font-semibold">Terms and Conditions</span>
        </label>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onAccept}
          className="flex-1 px-4 h-11 flex items-center justify-center rounded-xl shadow-sm hover:shadow-md transition-all duration-300 font-bold text-white shadow-emerald-100"
          style={{ backgroundColor: "#0E4B5A" }}
        >
          Accept
        </button>
        <button
          onClick={onDecline}
          className="flex-1 px-4 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}