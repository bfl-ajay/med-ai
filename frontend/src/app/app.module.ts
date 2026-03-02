import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AuthInterceptor } from './core/intercptors/auth.interceptor';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { HomeComponent } from './features/home/home.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { NavbarComponent } from './shared/navbar/navbar.component';

import { UploadReportsComponent } from './features/upload-reports/upload-reports.component';
import { UploadPrescriptionComponent } from './features/upload-prescription/upload-prescription.component';
import { AddInfoComponent } from './features/add-info/add-info.component';
import { ProfileComponent } from './features/profile/profile.component';

@NgModule({
    declarations: [
        AppComponent,
        HomeComponent,
        LoginComponent,
        RegisterComponent,
        DashboardComponent,
        NavbarComponent,
        UploadReportsComponent,       
        UploadPrescriptionComponent,  
        AddInfoComponent,
        ProfileComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        AppRoutingModule,
        HttpClientModule, 
        RouterModule
    ],
    providers: [{ 
        provide: HTTP_INTERCEPTORS, 
        useClass: AuthInterceptor, 
        multi: true
    }],
    bootstrap: [AppComponent]
})
export class AppModule { }