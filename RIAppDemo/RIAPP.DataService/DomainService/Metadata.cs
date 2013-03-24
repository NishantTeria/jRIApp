using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    public class Metadata
    {
        private List<DbSetInfo> _dbSets = new List<DbSetInfo>();
        private List<Association> _associations = new List<Association>();
     
        public List<DbSetInfo> DbSets
        {
            get
            {
                return _dbSets;
            }
            set
            {
                this._dbSets = value;
            }
        }


        public List<Association> Associations
        {
            get
            {
                return _associations;
            }
            set
            {
                this._associations = value;
            }
        }

    }
}
