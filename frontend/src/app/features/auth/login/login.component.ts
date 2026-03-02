import { Component } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';


@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
})
export class LoginComponent {
    email: string = '';
    password: string = '';
    showPassword: boolean = false;
    errorMessage: string = '';

    constructor(private authService: AuthService, private router: Router,) { }
    // ngOnInit() {
    //     this.route.queryParams.subscribe(params => {
    //         if (params['email']) {
    //             this.email = params['email'];
    //         }
    //     });
    // }
    login() {
        const data = {
            email: this.email,
            password: this.password
        };
        this.authService.login(data).subscribe({
            next: (res: any) => {
                console.log("Login response:", res);
                this.authService.saveToken(res.token);
                this.router.navigate(['/dashboard']);
            },
            error: (err: any) => {
                this.errorMessage = "Invalid credentials";
            }
        });
    }
}