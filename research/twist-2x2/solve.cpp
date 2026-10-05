#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <vector>
#include <set>
#include <array>
#include <ctime>
#include "tables.h"
using namespace std;
typedef uint64_t u64; typedef uint32_t u32;
static int LOCK, FACES, MARGIN;
static u32 RT[NROT][3][256];  // rotation tables on 24-bit masks
static vector<array<int,24>> SYM; static u32 ST[24][3][256]; static int NS;
static inline u32 app(u32 (*t)[256],u32 m){return t[0][m&255]|t[1][(m>>8)&255]|t[2][(m>>16)&255];}
static int PC[16]={0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4}; static int PR[5]={0,0,1,3,6};
static inline int nib(u32 m,int f){return (m>>(4*f))&15;}
static inline int lines(u32 m){int c=0;for(int f=0;f<6;f++)c+=PR[PC[nib(m,f)]];return c;}
static inline int faces(u32 m){int c=0;for(int f=0;f<6;f++)c+=PC[nib(m,f)]>=2;return c;}
static inline int sc(u32 m){return FACES?faces(m):lines(m);}
static inline int lockedMask(u32 x,u32 o){int k=0;for(int f=0;f<6;f++)if(PC[nib(x,f)]>=2||PC[nib(o,f)]>=2)k|=1<<f;return k;}
struct Ent{u64 key;};
static u64 *TT; static u64 TMASK;
// entry: bits 0..48 key (49 bits), bits 52..53 lo+1, 54..55 hi+1  (outcome mode only)
static u64 nodes=0; static clock_t T0;
static inline u64 canon(u32 x,u32 o,int ph){u64 best=~0ULL;for(int s=0;s<NS;s++){u64 k=((u64)app(ST[s],x)<<24)|app(ST[s],o);if(k<best)best=k;}return best*2+ph;}
static inline u64 H(u64 k){k*=0x9E3779B97F4A7C15ULL;return k^(k>>29);}
static int terminal(u32 x,u32 o){int a=sc(x),b=sc(o);return MARGIN?a-b:(a>b)-(a<b);}
static int search(u32 x,u32 o,int ph,int alpha,int beta){
  u32 full=x|o; int fl=__builtin_popcount(full);
  if(ph==0){int lm=LOCK?lockedMask(x,o):0;bool any=false;for(int f=0;f<6;f++)if(!((lm>>f)&1)&&nib(full,f)!=15){any=true;break;}if(!any)return terminal(x,o);}
  u64 key=canon(x,o,ph); u64 idx=H(key)&TMASK;
  int lo=-1,hi=1;
  for(int p=0;p<8;p++){u64 e=TT[(idx+p)&TMASK];if(!e)break;if((e&((1ULL<<50)-1))==key){lo=(int)((e>>52)&3)-1;hi=(int)((e>>54)&3)-1;
      if(lo==hi)return lo;if(lo>=beta)return lo;if(hi<=alpha)return hi;if(lo>alpha)alpha=lo;if(hi<beta)beta=hi;break;}}
  nodes++; if((nodes&((1ULL<<28)-1))==0){fprintf(stderr,"nodes=%llu t=%.0fs\n",(unsigned long long)nodes,(double)(clock()-T0)/CLOCKS_PER_SEC);}
  bool xm=(fl%2==0);
  int best=xm?-9:9,a0=alpha,b0=beta;
  int lm=LOCK?lockedMask(x,o):0; u32 mine=xm?x:o;
  for(int pass=0;pass<2&&alpha<beta;pass++)
  for(int i=0;i<24;i++){u32 b=1u<<i; if(full&b)continue; int f=i>>2; if((lm>>f)&1)continue;
    bool scores=PC[nib(mine,f)]>=1; if(scores!=(pass==0))continue;
    u32 nx=xm?x|b:x, no=xm?o:o|b; int v;
    if(!scores) v=search(nx,no,0,alpha,beta);
    else { v=xm?-9:9; int al=alpha,be=beta;
      for(int r=0;r<NROT;r++){ if(r%6>=3)continue; u32 rx=app(RT[r],nx),ro=app(RT[r],no); int w=search(rx,ro,0,al,be);
        if(xm){if(w>v)v=w;if(v>al)al=v;}else{if(w<v)v=w;if(v<be)be=v;} if(al>=be)break;} }
    if(xm){if(v>best)best=v;if(best>alpha)alpha=best;}else{if(v<best)best=v;if(best<beta)beta=best;}
    if(alpha>=beta)break;}
  // store
  int nlo=lo,nhi=hi;
  if(best<=a0)nhi=best<nhi?best:nhi; else if(best>=b0)nlo=best>nlo?best:nlo; else nlo=nhi=best;
  u64 e=key|((u64)(nlo+1)<<52)|((u64)(nhi+1)<<54);
  for(int p=0;p<8;p++){u64 &s=TT[(idx+p)&TMASK];if(!s||(s&((1ULL<<50)-1))==key){s=e;return best;}}
  TT[idx]=e;
  return best;
}
int main(int argc,char**argv){
  LOCK=atoi(argv[1]);FACES=atoi(argv[2]);MARGIN=0;int bits=argc>3?atoi(argv[3]):27;
  TMASK=(1ULL<<bits)-1;TT=(u64*)calloc(1ULL<<bits,8);
  for(int r=0;r<NROT;r++)for(int b=0;b<3;b++)for(int v=0;v<256;v++){u32 src=(u32)v<<(8*b),out=0;for(int d=0;d<24;d++)if((src>>ROT[r][d])&1)out|=1u<<d;RT[r][b][v]=out;}
  set<array<int,24>> seen;array<int,24> id;for(int i=0;i<24;i++)id[i]=i;vector<array<int,24>> q{id};seen.insert(id);
  for(size_t h=0;h<q.size();h++)for(int g=0;g<2;g++){array<int,24> cur=q[h];for(int k=0;k<2;k++){array<int,24> nx;for(int d=0;d<24;d++)nx[d]=cur[ROT[GEN[g][k]][d]];cur=nx;}if(!seen.count(cur)){seen.insert(cur);q.push_back(cur);}}
  NS=q.size();
  for(int s=0;s<NS;s++)for(int b=0;b<3;b++)for(int v=0;v<256;v++){u32 src=(u32)v<<(8*b),out=0;for(int d=0;d<24;d++)if((src>>q[s][d])&1)out|=1u<<d;ST[s][b][v]=out;}
  clock_t t0=clock();T0=t0;
  int v=search(0,0,0,-1,1);
  printf("lock=%d faces=%d value(X view)=%d nodes=%llu time=%.0fs\n",LOCK,FACES,v,(unsigned long long)nodes,(double)(clock()-t0)/CLOCKS_PER_SEC);
}
