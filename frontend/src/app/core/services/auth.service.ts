import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://localhost:5000';
    constructor(private http: HttpClient) { }

    register(data: any) {
        return this.http.post(`${this.apiUrl}/api/auth/register`, data);
    }
    login(data: any) {
        return this.http.post(`${this.apiUrl}/api/auth/login`, data);
    }
    saveToken(token: string) {
        localStorage.setItem('token', token);
    }
    getToken() {
        return localStorage.getItem('token');
    }
    logout() {
        localStorage.removeItem('token');
    }
    isLoggedIn() {
        return !!localStorage.getItem('token');
    }
    getProfile() {
        const token = localStorage.getItem('token');

        return this.http.get('http://localhost:5000/api/auth/profile', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    }
    getAuthHeaders() {
        const token = localStorage.getItem('token');

        return {
            headers: new HttpHeaders({
                Authorization: `Bearer ${token}`
            })
        };
    }
    getAIPlan(profile: any) {
        return this.http.post(
            `${this.apiUrl}/api/auth/ai-plan`,
            profile,
            this.getAuthHeaders()
        );
    }
    setMedicine(data: any) {
        return this.http.post(
            `${this.apiUrl}/api/auth/medicine`,
            data,
            this.getAuthHeaders()
        );
    }
    getReminders() {
        return this.http.get('http://localhost:5000/api/auth/reminders',
            this.getAuthHeaders()
        );
    }

    addReminder(data: any) {
        return this.http.post(
            'http://localhost:5000/api/auth/reminders', data,
            this.getAuthHeaders()
        );
    }

    updateReminder(id: number, data: any) {
        return this.http.put(`http://localhost:5000/api/auth/reminders/${id}`, data,
            this.getAuthHeaders()
        );
    }

    deleteReminder(id: number) {
        return this.http.delete(`http://localhost:5000/api/auth/reminders/${id}`,
            this.getAuthHeaders()
        );
    }

    uploadReport(formData: FormData) {
        return this.http.post('http://localhost:5000/api/auth/upload-report', formData,
            this.getAuthHeaders()
        );
    }

    getReports() {
        return this.http.get('http://localhost:5000/api/auth/reports',
            this.getAuthHeaders()
        );
    }
    deleteReport(id: number) {
        return this.http.delete(`http://localhost:5000/api/auth/report/${id}`,
            this.getAuthHeaders()
        );
    }
    uploadPrescription(formData: FormData) {
        return this.http.post(
            'http://localhost:5000/api/auth/upload-prescription',
            formData,
            this.getAuthHeaders()
        );
    }

    getPrescriptions() {
        return this.http.get(
            'http://localhost:5000/api/auth/prescriptions',
            this.getAuthHeaders()
        );
    }

    deletePrescription(id: number) {
        return this.http.delete(
            `http://localhost:5000/api/auth/prescriptions/${id}`,
            this.getAuthHeaders()
        );
    }

    saveManualPrescription(data: any) {
        return this.http.post(
            'http://localhost:5000/api/auth/save-manual-prescription',
            data,
            this.getAuthHeaders()
        );
    }
    saveAdditionalInfo(data: any) {
        return this.http.post(
            'http://localhost:5000/api/auth/save-add-info',
            data,
            this.getAuthHeaders()
        );
    }
    getAdditionalInfo() {
        return this.http.get(
            'http://localhost:5000/api/auth/get-add-info',
            this.getAuthHeaders()
        );
    }
    analyzePrescription(id: number) {
        return this.http.get(
            `http://localhost:5000/api/auth/analyze-prescription/${id}`,
            this.getAuthHeaders()
        );
    }
    analyzeReport(id: number) {
        return this.http.get(
            `http://localhost:5000/api/auth/analyze-report/${id}`,
            this.getAuthHeaders()
        );
    }
    addBloodPressure(data: any) {
        return this.http.post(
            'http://localhost:5000/api/auth/blood_pressure_records',
            data,
            this.getAuthHeaders()
        );
    }
    getBloodPressure() {
        return this.http.get(
            'http://localhost:5000/api/auth/blood_pressure_records',
            this.getAuthHeaders()
        );
    }
    sendContactMessage(data: any) {
        return this.http.post(
            'http://localhost:5000/api/auth/contact',
            data
        );
    }
}
