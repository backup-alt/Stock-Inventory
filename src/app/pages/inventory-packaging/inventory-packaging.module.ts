import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { InventoryPackagingPage } from './inventory-packaging.page';

const routes: Routes = [{ path: '', component: InventoryPackagingPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [InventoryPackagingPage]
})
export class InventoryPackagingPageModule {}
