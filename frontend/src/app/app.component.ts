import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../app/core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {

  constructor(private authService: AuthService, private router: Router) {}

}