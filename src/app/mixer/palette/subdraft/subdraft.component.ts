import { Component, OnInit, Input, Output, ViewChild, ElementRef, EventEmitter, HostListener, OnChanges, ChangeDetectionStrategy, SimpleChanges} from '@angular/core';
import { Point, Interlacement, Bounds, DraftMap } from '../../../core/model/datatypes';
import { InkService } from '../../provider/ink.service';
import { LayersService } from '../../provider/layers.service';
import utilInstance from '../../../core/model/util';
import { OperationService } from '../../provider/operation.service';
import { TreeService } from '../../provider/tree.service';
import { FileService } from '../../../core/provider/file.service';
import { ViewportService } from '../../provider/viewport.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DraftdetailComponent } from '../../modal/draftdetail/draftdetail.component';
import { Cell } from '../../../core/model/cell';
import { OperationComponent } from '../operation/operation.component';
import { Draft } from '../../../core/model/draft';
import { GloballoomService } from '../../../core/provider/globalloom.service';
import { MaterialsService } from '../../../core/provider/materials.service';




interface DesignActions{
  value: string;
  viewValue: string;
  icon: string;
}

@Component({
  selector: 'app-subdraft',
  templateUrl: './subdraft.component.html',
  styleUrls: ['./subdraft.component.scss']
})



export class SubdraftComponent implements OnInit {

  @Input()  id: number; //generated by the tree service
  @Input()  patterns: any;
  @Input()  default_cell: number;


  @Input()
  get scale(): number { return this._scale; }
  set scale(value: number) {
    this._scale = value;
    this.rescale();
  }
  private _scale:number = 5;

  @Input()
  get draft(): Draft { return this._draft; }
  set draft(value: Draft) {
    this._draft = value;
    this.drawDraft(value);
  }

  private _draft:Draft = null;

  @Input()
  get bounds(): Bounds { return this._bounds; }
  set bounds(value: Bounds) {
    this.updateViewport(value);
    this._bounds = value;
    ;
  }

  private _bounds:Bounds = {
    topleft: {x: 0, y: 0},
    width: 0, 
    height: 0
  };

  

  @Output() onSubdraftMove = new EventEmitter <any>(); 
  @Output() onSubdraftDrop = new EventEmitter <any>(); 
  @Output() onSubdraftStart = new EventEmitter <any>(); 
  @Output() onDeleteCalled = new EventEmitter <any>(); 
  @Output() onDuplicateCalled = new EventEmitter <any>(); 
  @Output() onConnectionMade = new EventEmitter <any>(); 
  @Output() onConnectionRemoved = new EventEmitter <any>(); 
  @Output() onDesignAction = new  EventEmitter <any>();
  @Output() onConnectionStarted:any = new EventEmitter<any>();
  @Output() onSubdraftViewChange:any = new EventEmitter<any>();
  @Output() onNameChange:any = new EventEmitter<any>();

  @ViewChild('bitmapImage') bitmap: any;



  canvas: HTMLCanvasElement;
  cx: any;

  parent_id: number = -1;

  /**
  * flag to tell if this is in a mode where it is looking foor a connectino
  */
  selecting_connection: boolean = false;


  /**
   * hold the top left point as an interlacement, independent of scale
   */
  interlacement: Interlacement;

  // private _scale: number; 

  ink = 'neq'; //can be or, and, neq, not, splice

  counter:number  =  0; // keeps track of how frequently to call the move functions
 
  counter_limit: number = 50;  //this sets the threshold for move calls, lower number == more calls
 
  last_ndx:Interlacement = {i: -1, j:-1, si: -1}; //used to check if we should recalculate a move operation

  moving: boolean  = false;
 
  disable_drag: boolean = false;

  is_preview: boolean = false;
 
  zndx = 0;

  has_active_connection: boolean = false;

  set_connectable:boolean = false;

  modal: MatDialogRef<DraftdetailComponent, any>;

  draft_visible: boolean = true;


  constructor(private inks: InkService, 
    private layer: LayersService, 
    private ms: MaterialsService, 
    public tree: TreeService,
    private fs: FileService,
    private viewport: ViewportService,
    private dialog: MatDialog,
    private gl: GloballoomService) { 

      this.zndx = layer.createLayer();

  }

  ngOnInit(){

    if(!this.is_preview) this.parent_id = this.tree.getSubdraftParent(this.id);
    const tl: Point = this.viewport.getTopLeft();
   

    if(this.bounds.topleft.x === 0 && this.bounds.topleft.y === 0) this.setPosition(tl);
    this.interlacement = utilInstance.resolvePointToAbsoluteNdx(this.bounds.topleft, this.scale);

    if(!this.is_preview) this.viewport.addObj(this.id, this.interlacement);

    const draft = this.tree.getDraft(this.id);

    if(draft !== undefined){
      this.bounds.width = draft.warps * this.scale;
      this.bounds.height = draft.wefts * this.scale;
    }else{
      this.bounds.width = draft.warps * this.scale;
      this.bounds.height = draft.wefts * this.scale;
    }

  }


  ngAfterViewInit() {


    this.canvas = <HTMLCanvasElement> document.getElementById(this.id.toString());
    this.cx = this.canvas.getContext("2d");
    this.drawDraft(this.draft); //force call here because it likely didn't render previously. 

    this.rescale();
    this.updateViewport(this.bounds);

  }

  nameFocusOut(){
    console.log("FOCUS OUT")
    this.onNameChange.emit(this.id);
  }


  /**
   * Called when main palette is rescaled and triggers call to rescale this element, and update its position 
   * so it remains at the same coords. 
   * @param scale - the zoom scale of the iterface (e.g. the number of pixels to render each cell)
   */
  rescale(){

    

    if(this.draft === null){
      return;
    } 

    const zoom_factor:number = this.scale/this.default_cell;

    //redraw at scale
    const container: HTMLElement = document.getElementById('scale-'+this.id.toString());
   
    if(container === null) return;


    container.style.transformOrigin = 'top left';
    container.style.transform = 'scale(' + zoom_factor + ')';

   
    this.bounds.topleft = {
      x: this.interlacement.j * this.scale,
      y: this.interlacement.i * this.scale
    };

    this.bounds.width = this.draft.warps * this.scale;
    this.bounds.height = this.draft.wefts * this.scale;

  }

  /**called when bounds change, updates the global view port */
  updateViewport(bounds: Bounds){
    this.interlacement = utilInstance.resolvePointToAbsoluteNdx(bounds.topleft, this.scale);
    this.viewport.updatePoint(this.id, this.interlacement);

  }

  /**
   * updates this components position based on the input component's position
   * */
  updatePositionFromParent(parent: OperationComponent){

    if(this.parent_id !== parent.id){
      console.error("attempitng to update subdraft position from non-parent operation", this.parent_id, parent.id);
      return;
    }

    this.setPosition({x: parent.bounds.topleft.x, y: parent.bounds.topleft.y + parent.bounds.height})

  }


    updateSize(parent: OperationComponent){

      const draft = this.tree.getDraft(this.id);

      this.bounds.width = draft.warps * this.scale;
      this.bounds.height = draft.wefts * this.scale;

      if(this.parent_id !== parent.id){
        console.error("attempitng to update subdraft position from non-parent operation", this.parent_id, parent.id);
        console.log("attempitng to update subdraft position from non-parent operation", this.parent_id, parent.id);
        return;
      }

      this.bounds.width = Math.max(parent.bounds.width, this.bounds.width);
      this.bounds.height = Math.max(parent.bounds.height, this.bounds.height);
  
  
    }
  



  /**
   * Called when main palette is rescaled and triggers call to rescale this element, and update its position 
   * so it remains at the same coords. 
   * @param scale - the zoom scale of the iterface (e.g. the number of pixels to render each cell)
   */
   rescaleForBitmap(){

    
    if(this.canvas === undefined) return;
    const draft = this.tree.getDraft(this.id);


    this.canvas.width = draft.warps * this.default_cell;
    this.canvas.height = draft.wefts * this.default_cell;

    for (let i = 0; i < draft.wefts; i++) {
      for (let j = 0; j < draft.warps; j++) {
        this.drawCell(draft, 1, i, j, false);
      }
    }
  }

  connectionEnded(){
    this.selecting_connection = false;
    this.enableDrag();
  }

  connectionStarted(event: any){
    this.selecting_connection = true;
    
    this.disableDrag();

    this.onConnectionStarted.emit({
      event: event,
      id: this.id
    });

  }



  /**
   * called on create to position the element on screen
   * @param pos 
   */
  setPosition(pos: Point){
    this.enableDrag();
    this.bounds.topleft = pos;
    this.updateViewport(this.bounds);
  }



  public inkActionChange(name: any){
    this.ink = name;
    this.inks.select(name);
    //this.drawDraft();
  }

  /**
   * gets the next z-ndx to place this in front
   */
  public setAsPreview(){
    this.is_preview = true;
     this.zndx = this.layer.createLayer();
  }

 

  /**
   * does this subdraft exist at this point?
   * @param p the absolute position of the coordinate (based on the screen)
   * @returns true/false for yes or no
   */
  public hasPoint(p:Point) : boolean{

      const endPosition = {
        x: this.bounds.topleft.x + this.bounds.width,
        y: this.bounds.topleft.y + this.bounds.height,
      };

      if(p.x < this.bounds.topleft.x || p.x > endPosition.x) return false;
      if(p.y < this.bounds.topleft.y || p.y > endPosition.y) return false;

    
    return true;

  }


/**
 * Takes row/column position in this subdraft and translates it to an absolution position  
 * @param ndx the index
 * @returns the absolute position as nxy
 */
 public resolveNdxToPoint(ndx:Interlacement) : Point{
  
  let y = this.bounds.topleft.y + ndx.i * this.scale;
  let x = this.bounds.topleft.x + ndx.j * this.scale;
  return {x: x, y:y};

}

/**
 * Takes an absolute coordinate and translates it to the row/column position Relative to this subdraft
 * @param p the screen coordinate
 * @returns the row and column within the draft (i = row, j=col), returns -1 if out of bounds
 */
  public resolvePointToNdx(p:Point) : Interlacement{
    const draft = this.tree.getDraft(this.id);

    let i = Math.floor((p.y -this.bounds.topleft.y) / this.scale);
    let j = Math.floor((p.x - this.bounds.topleft.x) / this.scale);

    if(i < 0 || i >= draft.wefts) i = -1;
    if(j < 0 || j >= draft.warps) j = -1;

    return {i: i, j:j, si: i};

  }



/**
 * takes an absolute reference and returns the value at that cell boolean or null if its unset
 * @param p a point of the absolute poistion of coordinate in question
 * @returns true/false/or null representing the eddle value at this point
 */
  public resolveToValue(p:Point) : boolean{

    const coords = this.resolvePointToNdx(p);

    if(coords.i < 0 || coords.j < 0) return null; //this out of range
    
    const draft = this.tree.getDraft(this.id);

    if(!draft.pattern[coords.i][coords.j].isSet()) return null;
    
    return draft.pattern[coords.i][coords.j].isUp();
  
  }


  // /**
  //  * sets a new draft
  //  * @param temp the draft to set this component to
  //  */
  // setNewDraft(temp: Draft) {

  //   this.bounds.width = temp.warps * this.scale;
  //   this.bounds.height = temp.wefts * this.scale;
  //   this.draft.reload(temp);
  //   this.drawDraft();

  // }

  // setComponentPosition(point: Point){
  //   this.bounds.topleft = point;
  // }


  setComponentBounds(bounds: Bounds){
    this.setPosition(bounds.topleft);
    this.bounds = bounds;
  }
  /**
   * manually sets the component size. While such an operation should be handled on init but there is a bug where this value is checked before the 
   * component runds its init sequence. Manually adding the data makes it possible for check for intersections on selection and drawing end.
   * @param width 
   * @param height 
   */
  setComponentSize(width: number, height: number){
    this.bounds.width = width;
    this.bounds.height = height;
  }

  async drawCell(draft, cell_size, i, j, usecolor){
    let is_up = draft.isUp(i,j);
    let is_set = draft.isSet(i, j);
    let color = "#ffffff"
    if(is_set){
      if(this.ink === 'unset' && is_up){
        this.cx.fillStyle = "#999999"; 
      }else{
        if(is_up){
          color = usecolor ? this.ms.getColor(draft.getWarpShuttleId(j)) : '#000000';
        }else{
          color = usecolor ? this.ms.getColor(draft.getWeftShuttleId(i)) : '#ffffff';
        }
        this.cx.fillStyle = color;
      }
    } else{
      this.cx.fillStyle =  '#0000000d';
    // this.cx.fillStyle =  '#ff0000';

    }
    this.cx.fillRect(j*cell_size, i*cell_size, cell_size, cell_size);
  }

  redrawExistingDraft(){
    this.drawDraft(this.draft);
  }

  /**
   * draw whetever is stored in the draft object to the screen
   * @returns 
   */
  async drawDraft(draft: Draft) : Promise<any> {

    if(this.canvas === undefined) return;
    this.cx = this.canvas.getContext("2d");
   
    if(draft === null){
      this.canvas.width = 0;
      this.canvas.height = 0;

    }else{
      this.canvas.width = draft.warps * this.default_cell;
      this.canvas.height = draft.wefts * this.default_cell;

      for (let i = 0; i < draft.wefts; i++) {
        for (let j = 0; j < draft.warps; j++) {
          this.drawCell(draft, this.default_cell, i, j, true);
        }
      }
    }
    this.tree.setDraftClean(this.id);
    return "complete";
  }


  /**
   * draw onto the supplied canvas, to be used when printing
   * @returns 
   */
   drawForPrint(canvas, cx, scale: number) {

    // if(canvas === undefined) return;
    // const draft = this.tree.getDraft(this.id);

    // for (let i = 0; i < draft.wefts; i++) {
    //   for (let j = 0; j < draft.warps; j++) {
    //     let is_up = draft.isUp(i,j);
    //     let is_set = draft.isSet(i, j);
    //     if(is_set){
    //       if(this.ink === 'unset' && is_up){
    //         cx.fillStyle = "#999999"; 
    //       }else{
    //         cx.fillStyle = (is_up) ?  '#000000' :  '#ffffff';
    //       }
    //     } else{
    //       cx.fillStyle =  '#0000000d';
    //     }
    //     cx.fillRect(j*scale+this.bounds.topleft.x, i*scale+this.bounds.topleft.y, scale, scale);
    //   }
    // }

    // //draw the supplemental info like size
    // cx.fillStyle = "#666666";
    // cx.font = "20px Verdana";

    // let datastring: string =  draft.warps + " x " + draft.wefts;
    // cx.fillText(datastring,this.bounds.topleft.x + 5, this.bounds.topleft.y+this.bounds.height + 20 );

  }





  /**
   * gets the position of this elment on the canvas. Dyanic top left might be bigger due to scolling intersection
   * previews. Use static for all calculating of intersections, etc. 
   * @returns 
   */
  getTopleft(): Point{
    return this.bounds.topleft;
  }



  
  isSameBoundsAs(bounds: Bounds) : boolean {   
    if(bounds.topleft.x != this.bounds.topleft.x) return false;
    if(bounds.topleft.y != this.bounds.topleft.y) return false;
    if(bounds.width != this.bounds.width) return false;
    if(bounds.height != this.bounds.height) return false;
    return true;
  }
  

  dragEnd($event: any) {
    this.moving = false;
    this.counter = 0;  
    this.last_ndx = {i: -1, j:-1, si: -1};
    this.onSubdraftDrop.emit({id: this.id});
  }

  dragStart($event: any) {
    this.moving = true;
    this.counter = 0;  
    this.onSubdraftStart.emit({id: this.id});
 

  }

  dragMove($event: any) {
    //position of pointer of the page
    const pointer:Point = $event.pointerPosition;

    const relative:Point = utilInstance.getAdjustedPointerPosition(pointer, this.viewport.getBounds());
    const adj:Point = utilInstance.snapToGrid(relative, this.scale);


    this.bounds = ({
      topleft: adj, 
      width: this.bounds.width,
      height: this.bounds.height
    });

    // this.bounds.topleft = adj;

     const ndx = utilInstance.resolvePointToAbsoluteNdx(adj, this.scale);
    this.interlacement = ndx;
    
    if(this.counter%this.counter_limit === 0 || !utilInstance.isSameNdx(this.last_ndx, ndx)){
      this.onSubdraftMove.emit({id: this.id, point: adj});
      this.counter = 0;
    } 

    this.counter++;
    this.last_ndx = ndx;

  }

  disableDrag(){
    this.disable_drag = true;
  }

  enableDrag(){
    this.disable_drag = false;
  }

  showhide(){
    this.draft_visible = !this.draft_visible;
    this.onSubdraftViewChange.emit(this.id);
  }

  connectionClicked(id:number){
    this.has_active_connection  = true;
    // if(this.active_connection_order === 0){
    //   this.onConnectionMade.emit(id);
    // }else{
    //   this.onConnectionRemoved.emit(id);
    // }


  }

  resetConnections(){
    this.has_active_connection = false;
  }



  async designActionChange(e){
    const draft = this.tree.getDraft(this.id);

    switch(e){
      case 'duplicate':   
      this.onDuplicateCalled.emit({id: this.id});
      break;

      case 'delete': 
        this.onDeleteCalled.emit({id: this.id});
      break;

      default: 
        this.onDesignAction.emit({id: this.id});
      break;

    }
  }


  /**
   * Draws to hidden bitmap canvas a file in which each draft cell is represented as a single pixel. 
   * @returns 
   */
  async saveAsBmp() : Promise<any> {

    this.rescaleForBitmap();

    let b = this.bitmap.nativeElement;
    let context = b.getContext('2d');
    const draft = this.tree.getDraft(this.id);

    b.width = (draft.warps);
    b.height = (draft.wefts);
    
    context.fillStyle = "white";
    context.fillRect(0,0,b.width,b.height);
    context.drawImage(this.canvas, 0, 0);

    const a = document.createElement('a')
    return this.fs.saver.bmp(b)
    .then(href => {
      a.href =  href;
      a.download = draft.getName() + "_bitmap.jpg";
      a.click();
      this.drawDraft(draft);

    });
    


      
  }
  
    async saveAsAda() : Promise<any>{
      const draft = this.tree.getDraft(this.id);

      const a = document.createElement('a');
      return this.fs.saver.ada('draft', [draft], [], false, this.scale).then(out => {
        a.href = "data:application/json;charset=UTF-8," + encodeURIComponent(out.json);
        a.download = draft.getName() + ".ada";
        a.click();
      }); 
    }
  
    async saveAsWif() {

      const draft = this.tree.getDraft(this.id);
      const loom = this.tree.getLoom(this.id);

      
      

      const a = document.createElement('a');
      return this.fs.saver.wif(draft, loom)
      .then(href => {
        a.href = href;
        a.download  = draft.getName() +".wif";
        a.click();
      });
    
    }
  
    async saveAsPrint() {
     
      let dims = this.scale;
      let b = this.bitmap.nativeElement;
      let context = b.getContext('2d');

      const draft = this.tree.getDraft(this.id);


      b.width = (draft.warps ) * dims;
      b.height = (draft.wefts) * dims;
      
      context.fillStyle = "white";
      context.fillRect(0,0,b.width,b.height);
      

      context.drawImage(this.canvas, 0, 0);

      const a = document.createElement('a')
      return this.fs.saver.jpg(b)
        .then(href => {
          a.href =  href;
          a.download = draft.getName() + ".jpg";
          a.click();
      
        });
    }



    finetune(){

      //if this is already open, don't reopen it
      if(this.modal != undefined && this.modal.componentInstance != null) return;
      const draft = this.tree.getDraft(this.id);
      const loom = this.tree.getLoom(this.id);

      this.modal = this.dialog.open(DraftdetailComponent,
        {disableClose: true,
          hasBackdrop: false,
          data: {
            draft: draft,
            loom: loom,
            ink: this.inks.getInk(this.ink).viewValue,
            viewonly: (this.parent_id !== -1)}
        });



        this.modal.afterClosed().subscribe(result => {
          if(result != null){
            if(this.parent_id == -1){
              draft.reload(result);
              this.draft = draft;
              this.onDesignAction.emit({id: this.id});
              //flag for downstream calculations
            }
          }
        })   
       }

 


}
