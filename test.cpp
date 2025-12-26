#include <unordered_map>
#include <iostream>

using namespace std;

int main(){
    unordered_map<int, int> mp;
    int dummy, val;

    cout << "Sample unordered_map created successfully." << endl;
    cin >> dummy;
   
    cout<<"enter a number to exit: ";
    cin >> val;

    mp[dummy]=val;
   
    cout<<mp[dummy]<<endl;
}