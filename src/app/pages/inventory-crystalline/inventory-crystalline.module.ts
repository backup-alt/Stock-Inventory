import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { InventoryCrystallinePage } from './inventory-crystalline.page';

const routes: Routes = [{ path: '', component: InventoryCrystallinePage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [InventoryCrystallinePage]
})
export class InventoryCrystallinePageModule {}
