import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { InventoryConsumablesPage } from './inventory-consumables.page';

const routes: Routes = [{ path: '', component: InventoryConsumablesPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [InventoryConsumablesPage]
})
export class InventoryConsumablesPageModule {}
