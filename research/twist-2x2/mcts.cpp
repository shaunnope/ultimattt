#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cmath>
#include <vector>
#include <ctime>
#include "tables.h"
using namespace std;
typedef uint64_t u64; typedef uint32_t u32;
static int LOCK,FACES;
static u32 RT[NROT][3][256];
static inline u32 app(u32 (*t)[256],u32 m){return t[0][m&255]|t[1][(m>>8)&255]|t[2][(m>>16)&255];}
static const int PC[16]={0,1,1,2,1,2,2,3,1,2,2,3,2,3,3,4}, PR[5]={0,0,1,3,6};
static inline int nib(u32 m,int f){return (m>>(4*f))&15;}
static inline int sc(u32 m){int c=0;for(int f=0;f<6;f++){int n=PC[nib(m,f)];c+=FACES?(n>=2):PR[n];}return c;}
static inline int lockedMask(u32 x,u32 o){int k=0;for(int f=0;f<6;f++)if(PC[nib(x,f)]>=2||PC[nib(o,f)]>=2)k|=1<<f;return k;}
static u64 rs=88172645463325252ULL;
static inline u64 rnd(){rs^=rs<<13;rs^=rs>>7;rs^=rs<<17;return rs;}
struct S{u32 x,o;int ph;};
static inline bool xmove(const S&s){int fl=__builtin_popcount(s.x|s.o);return s.ph==0?fl%2==0:(fl-1)%2==0;}
// moves encoded: 0..23 place, 24..32 rotate layer-0 (r index 0..8 -> ROT idx)
static int ROTIDX[9];
static bool terminal(const S&s){if(s.ph)return false;u32 full=s.x|s.o;int lm=LOCK?lockedMask(s.x,s.o):0;for(int f=0;f<6;f++)if(!((lm>>f)&1)&&nib(full,f)!=15)return false;return true;}
static int gen(const S&s,int*mv){int n=0;if(s.ph){for(int r=0;r<9;r++)mv[n++]=24+r;return n;}
  u32 full=s.x|s.o;int lm=LOCK?lockedMask(s.x,s.o):0;for(int i=0;i<24;i++)if(!((full>>i)&1)&&!((lm>>(i>>2))&1))mv[n++]=i;return n;}
static S apply(S s,int m){bool xm=xmove(s);if(m<24){u32 mine=xm?s.x:s.o;bool scores=PC[nib(mine,m>>2)]>=1;if(xm)s.x|=1u<<m;else s.o|=1u<<m;s.ph=scores;return s;}
  int r=ROTIDX[m-24];s.x=app(RT[r],s.x);s.o=app(RT[r],s.o);s.ph=0;return s;}
static int outcome(const S&s){int a=sc(s.x),b=sc(s.o);return (a>b)-(a<b);}
static int margin(const S&s){return sc(s.x)-sc(s.o);}
static int rollout(S s){int mv[32];while(!terminal(s)){int n=gen(s,mv);s=apply(s,mv[rnd()%n]);}return outcome(s);}
struct Node{S s;int mover;int parent;int move;vector<int> kids;int untried[32];int nu;float w;int n;};
// w: wins for the player who made the move into node (1 win, .5 tie)
static int search(const S&root,int iters){
  vector<Node> t;t.reserve(iters+2);
  Node r;r.s=root;r.mover=-1;r.parent=-1;r.move=-1;r.nu=gen(root,r.untried);r.w=0;r.n=0;t.push_back(r);
  for(int it=0;it<iters;it++){
    int cur=0;
    while(t[cur].nu==0&&!t[cur].kids.empty()){ // select
      double best=-1;int bi=-1;double ln=log((double)t[cur].n+1);
      for(int k:t[cur].kids){double u=t[k].w/t[k].n+1.0*sqrt(ln/t[k].n);
        // child's w is from perspective of the player who moved into child == mover at cur
        if(u>best){best=u;bi=k;}}
      cur=bi;}
    if(t[cur].nu>0&&!terminal(t[cur].s)){ // expand
      int j=rnd()%t[cur].nu;int m=t[cur].untried[j];t[cur].untried[j]=t[cur].untried[--t[cur].nu];
      Node c;c.s=apply(t[cur].s,m);c.mover=xmove(t[cur].s)?1:0;c.parent=cur;c.move=m;c.nu=terminal(c.s)?0:gen(c.s,c.untried);c.w=0;c.n=0;
      t.push_back(c);int id=t.size()-1;t[cur].kids.push_back(id);cur=id;}
    int res=terminal(t[cur].s)?outcome(t[cur].s):rollout(t[cur].s); // +1 X wins
    for(int k=cur;k>0;k=t[k].parent){ // credit
      double v=res==0?0.5:((res>0)==(t[k].mover==1)?1.0:0.0);
      t[k].w+=v;t[k].n++;}
    t[0].n++;
  }
  int bm=-1,bn=-1;for(int k:t[0].kids)if(t[k].n>bn){bn=t[k].n;bm=t[k].move;}
  return bm;
}
int main(int argc,char**argv){
  LOCK=atoi(argv[1]);FACES=atoi(argv[2]);int iters=atoi(argv[3]);int secs=atoi(argv[4]);rs^=(u64)atoi(argv[5])*0x9E3779B97F4A7C15ULL;
  int xi=argc>6?atoi(argv[6]):iters; // X strength override
  for(int r=0;r<NROT;r++)for(int b=0;b<3;b++)for(int v=0;v<256;v++){u32 src=(u32)v<<(8*b),out=0;for(int d=0;d<24;d++)if((src>>ROT[r][d])&1)out|=1u<<d;RT[r][b][v]=out;}
  int c=0;for(int r=0;r<NROT;r++)if(r%6<3)ROTIDX[c++]=r;
  // random baseline
  long rx=0,ro=0,rt=0;for(int g=0;g<200000;g++){int o=rollout(S{0,0,0});if(o>0)rx++;else if(o<0)ro++;else rt++;}
  printf("lock=%d faces=%d RANDOM play 200k games: X %.1f%% O %.1f%% tie %.1f%%\n",LOCK,FACES,rx/2000.0,ro/2000.0,rt/2000.0);
  long wx=0,wo=0,tt=0,g=0;double mg=0;time_t t0=time(0);
  while(time(0)-t0<secs){S s{0,0,0};while(!terminal(s)){int it=xmove(s)?xi:iters;s=apply(s,search(s,it));}
    int o=outcome(s);if(o>0)wx++;else if(o<0)wo++;else tt++;mg+=margin(s);g++;}
  printf("lock=%d faces=%d MCTS X=%d iters, O=%d iters, %ld games: X wins %ld, O wins %ld, ties %ld, avg margin(X-O) %.2f\n",LOCK,FACES,xi,iters,g,wx,wo,tt,mg/g);
}
